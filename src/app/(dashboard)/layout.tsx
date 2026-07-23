import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Sidebar } from "@/components/layout/Sidebar";
import { Navbar } from "@/components/layout/Navbar";
import { MobileNav } from "@/components/layout/MobileNav";
import { RealtimeNotificationProvider } from "@/components/shared/RealtimeNotificationProvider";
import { countApprovablePRs } from "@/lib/pr/approvals";

/**
 * นับเอกสารของตัวเองที่ไม่สมบูรณ์ (ถูกตีกลับ + จ่ายแล้วแต่ค้างเอกสารตัวจริง)
 * ต้องเช็คสถานะ PR ด้วย เพราะใบที่ส่งหลักฐานใหม่ไปแล้วไม่ควรนับซ้ำ
 * - count        = ทั้งหมด (ป้ายเมนู "งานเอกสารไม่สมบูรณ์")
 * - pendingFixIds = ใบที่ถูกตีกลับและ PR ยังเป็น approved/converted
 *                   ใช้หักออกจากป้าย "งานเอกสาร" ไม่ให้นับซ้ำ
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function countIncompleteDocs(
  supabase: any,
  userId: string
): Promise<{ count: number; pendingFixIds: Set<string> }> {
  const empty = { count: 0, pendingFixIds: new Set<string>() };

  // ใบที่ฉันเป็นเจ้าของก่อน แล้วค่อยดึงหลักฐานของใบเหล่านั้น
  // (ไม่กรองด้วย submitted_by เพราะบางใบ บช./แอดมินกดส่งแทน — ต้องอ่านสถานะเอกสาร
  //  ให้ตรงกับหน้า "งานเอกสารของฉัน" ไม่งั้นใบที่จ่ายแล้วเอกสารไม่ครบจะหลุดหาย)
  const { data: myPRs } = await supabase
    .from("purchase_requisitions")
    .select("id, status")
    .eq("requester_id", userId)
    .limit(300);

  const prList = (myPRs ?? []) as { id: string; status: string }[];
  if (prList.length === 0) return empty;

  const prStatusById: Record<string, string> = Object.fromEntries(
    prList.map((p) => [p.id, p.status])
  );

  // ต้องดูหลักฐาน "ฉบับล่าสุด" ต่อใบเสมอ ไม่งั้นจะนับแถว incomplete เก่าที่ถูกแก้/
  // ส่งให้การเงินตรวจไปแล้วซ้ำ ทำให้ตัวเลขเกินจริง
  const { data: evRows } = await supabase
    .from("payment_evidences")
    .select("pr_id, status, close_status, submitted_at")
    .in("pr_id", prList.map((p) => p.id))
    .order("submitted_at", { ascending: false })
    .limit(400);

  if (!evRows || evRows.length === 0) return empty;

  const latestByPr = new Map<string, { status: string; close_status: string | null }>();
  for (const ev of evRows as any[]) {
    if (!latestByPr.has(ev.pr_id)) latestByPr.set(ev.pr_id, ev);
  }

  let count = 0;
  const pendingFixIds = new Set<string>();
  for (const [prId, ev] of latestByPr) {
    const prStatus = prStatusById[prId];
    if (!prStatus) continue;
    // จ่ายแล้วแต่ค้างเอกสารตัวจริง = เอกสารไม่สมบูรณ์
    const isAwaitingDocs = prStatus === "paid" && ev.close_status === "incomplete";
    // ถูกตีกลับก่อนจ่าย รอแก้แล้วส่งใหม่ (งานตีกลับ)
    const isPendingFix =
      ev.status === "returned" &&
      ev.close_status === "incomplete" &&
      ["approved", "converted"].includes(prStatus);
    if (isPendingFix) pendingFixIds.add(prId);
    if (isAwaitingDocs || isPendingFix) count++;
  }
  return { count, pendingFixIds };
}

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const [{ data: profile }, { data: myMemberships }] = await Promise.all([
    supabase
      .from("profiles")
      .select("full_name, email, role, department, line_user_id")
      .eq("id", user.id)
      .single(),
    (supabase as any).from("position_members").select("position_id").eq("user_id", user.id),
  ]);

  if (!profile) {
    redirect("/login");
  }

  const avatarUrl = user.user_metadata?.avatar_url as string | undefined;

  const isApprover = profile.role === "manager" || profile.role === "admin";
  const isFinance = profile.role === "finance" || profile.role === "admin";

  // ขอบเขตสิทธิ์อนุมัติ — ใช้นับ badge "รออนุมัติ" ให้ตรงกับหน้า /approvals (รวมสมาชิกตำแหน่ง)
  const approverScope = {
    role: profile.role,
    department: profile.department ?? null,
    positionIds: ((myMemberships ?? []) as { position_id: string }[]).map((m) => m.position_id),
  };

  // ยิงทุก query สำหรับ badge พร้อมกันในรอบเดียว (เดิมยิงทีละอันตามลำดับ)
  const [approvalCountValue, editedRes, verifyRes, companyRes, pettyRes, fixedRes, incompleteInfo, todoRes] = await Promise.all([
    countApprovablePRs(supabase, approverScope),
    isApprover
      ? (supabase as any).from("pr_item_edit_logs").select("pr_id").limit(200)
      : Promise.resolve({ data: [] }),
    isFinance
      ? (supabase as any)
          .from("payment_evidences")
          .select("pr_id, purchase_requisitions!inner(status)")
          .eq("status", "submitted")
          .eq("purchase_requisitions.status", "pending_finance")
          .limit(500)
      : Promise.resolve({ data: [] }),
    // รอจ่าย — ช่องทางบริษัทสั่งจ่าย (verified + channel company/null)
    isFinance
      ? (supabase as any)
          .from("payment_evidences")
          .select("pr_id, purchase_requisitions!inner(status)")
          .eq("status", "verified")
          .or("payment_channel.eq.company,payment_channel.is.null")
          .eq("purchase_requisitions.status", "pending_finance")
          .limit(500)
      : Promise.resolve({ data: [] }),
    // รอจ่าย — ช่องทางเงินสดย่อย (verified + channel petty_cash)
    isFinance
      ? (supabase as any)
          .from("payment_evidences")
          .select("pr_id, purchase_requisitions!inner(status)")
          .eq("status", "verified")
          .eq("payment_channel", "petty_cash")
          .eq("purchase_requisitions.status", "pending_finance")
          .limit(500)
      : Promise.resolve({ data: [] }),
    // เอกสารที่คนเบิกแก้แล้วรอ บช. ตรวจ (paid + close_status fixed)
    isFinance
      ? (supabase as any)
          .from("payment_evidences")
          .select("pr_id, purchase_requisitions!inner(status)")
          .eq("close_status", "fixed")
          .eq("purchase_requisitions.status", "paid")
          .limit(500)
      : Promise.resolve({ data: [] }),
    countIncompleteDocs(supabase, user.id),
    (supabase as any)
      .from("purchase_requisitions")
      .select("id", { count: "exact", head: true })
      .eq("requester_id", user.id)
      .in("status", ["draft", "returned", "rejected", "approved", "converted"]),
  ]);

  const approvalCount = approvalCountValue;
  const editedCount = new Set(((editedRes.data ?? []) as any[]).map((r) => r.pr_id)).size;
  // นับตามจำนวนใบ (distinct pr_id) ไม่ใช่จำนวนแถวหลักฐาน — ให้ตรงกับหน้างานตรวจสอบ
  const verifyCount = new Set(((verifyRes.data ?? []) as any[]).map((r) => r.pr_id)).size;
  // รอจ่ายแต่ละช่องทาง (distinct pr_id) — ให้ตรงกับหน้ารายการบริษัทสั่งจ่าย / เงินสดย่อย
  const companyCount = new Set(((companyRes.data ?? []) as any[]).map((r) => r.pr_id)).size;
  const pettyCashCount = new Set(((pettyRes.data ?? []) as any[]).map((r) => r.pr_id)).size;
  const fixedReviewCount = new Set(((fixedRes.data ?? []) as any[]).map((r) => r.pr_id)).size;
  const incompleteCount = incompleteInfo.count;
  // งานเอกสาร = งานของเจ้าของทั้งหมด แต่หักใบที่ถูก บช. ตีกลับออก (ไปนับที่ "ไม่สมบูรณ์" แทน)
  const todoCount = Math.max(0, (todoRes.count ?? 0) - incompleteInfo.pendingFixIds.size);

  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar role={profile.role} approvalCount={approvalCount} editedCount={editedCount} verifyCount={verifyCount} companyCount={companyCount} pettyCashCount={pettyCashCount} fixedReviewCount={fixedReviewCount} incompleteCount={incompleteCount} todoCount={todoCount} approverDepartment={approverScope.department} approverPositionIds={approverScope.positionIds} />
      <div className="flex flex-1 flex-col min-w-0">
        <Navbar profile={profile} avatarUrl={avatarUrl} />
        <main className="flex-1 px-4 py-6 pb-24 lg:pb-6 lg:px-6">
          {children}
        </main>
        <MobileNav
          role={profile.role as import("@/types/database").UserRole}
          approvalCount={approvalCount}
          verifyCount={verifyCount}
          companyCount={companyCount}
          pettyCashCount={pettyCashCount}
          fixedReviewCount={fixedReviewCount}
          incompleteCount={incompleteCount}
          todoCount={todoCount}
          approverDepartment={approverScope.department}
          approverPositionIds={approverScope.positionIds}
        />
      </div>
      {/* Real-time toast notifications — ไม่กระทบ layout เดิม */}
      <RealtimeNotificationProvider userId={user.id} role={profile.role as import("@/types/database").UserRole} />
    </div>
  );
}
