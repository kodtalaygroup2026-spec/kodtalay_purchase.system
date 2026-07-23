import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Sidebar } from "@/components/layout/Sidebar";
import { Navbar } from "@/components/layout/Navbar";
import { MobileNav } from "@/components/layout/MobileNav";
import { RealtimeNotificationProvider } from "@/components/shared/RealtimeNotificationProvider";
import { countApprovablePRs } from "@/lib/pr/approvals";
import { countIncompleteDocs } from "@/lib/pr/incompleteDocs";


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
      <Sidebar role={profile.role} userId={user.id} approvalCount={approvalCount} editedCount={editedCount} verifyCount={verifyCount} companyCount={companyCount} pettyCashCount={pettyCashCount} fixedReviewCount={fixedReviewCount} incompleteCount={incompleteCount} todoCount={todoCount} approverDepartment={approverScope.department} approverPositionIds={approverScope.positionIds} />
      <div className="flex flex-1 flex-col min-w-0">
        <Navbar profile={profile} avatarUrl={avatarUrl} />
        <main className="flex-1 px-4 py-6 pb-24 lg:pb-6 lg:px-6">
          {children}
        </main>
        <MobileNav
          role={profile.role as import("@/types/database").UserRole}
          userId={user.id}
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
