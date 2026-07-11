import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Sidebar } from "@/components/layout/Sidebar";
import { Navbar } from "@/components/layout/Navbar";
import { MobileNav } from "@/components/layout/MobileNav";
import { RealtimeNotificationProvider } from "@/components/shared/RealtimeNotificationProvider";

/**
 * นับเอกสารของตัวเองที่ไม่สมบูรณ์ (ถูกตีกลับ + จ่ายแล้วแต่ค้างเอกสารตัวจริง)
 * ต้องเช็คสถานะ PR ด้วย เพราะใบที่ส่งหลักฐานใหม่ไปแล้วไม่ควรนับซ้ำ
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function countIncompleteDocs(supabase: any, userId: string): Promise<number> {
  const { data: incRows } = await supabase
    .from("payment_evidences")
    .select("pr_id, status, submitted_at")
    .eq("submitted_by", userId)
    .eq("close_status", "incomplete")
    .order("submitted_at", { ascending: false })
    .limit(200);

  if (!incRows || incRows.length === 0) return 0;

  const incPrIds = [...new Set(incRows.map((r: any) => r.pr_id))];
  const { data: incPrs } = await supabase
    .from("purchase_requisitions")
    .select("id, status")
    .in("id", incPrIds);
  const prStatusById: Record<string, string> = Object.fromEntries(
    (incPrs ?? []).map((p: any) => [p.id, p.status])
  );

  let count = 0;
  const seen = new Set<string>();
  for (const ev of incRows as any[]) {
    if (seen.has(ev.pr_id)) continue;
    seen.add(ev.pr_id);
    const prStatus = prStatusById[ev.pr_id];
    if (!prStatus) continue;
    const isPendingFix = ev.status === "returned" && ["approved", "converted"].includes(prStatus);
    const isAwaitingDocs = ev.status === "paid";
    if (isPendingFix || isAwaitingDocs) count++;
  }
  return count;
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

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, email, role, department, line_user_id")
    .eq("id", user.id)
    .single();

  if (!profile) {
    redirect("/login");
  }

  const avatarUrl = user.user_metadata?.avatar_url as string | undefined;

  const isApprover = profile.role === "manager" || profile.role === "admin";
  const isFinance = profile.role === "finance" || profile.role === "admin";

  // ยิงทุก query สำหรับ badge พร้อมกันในรอบเดียว (เดิมยิงทีละอันตามลำดับ)
  const [approvalRes, editedRes, verifyRes, incompleteCount, todoRes] = await Promise.all([
    isApprover
      ? (supabase as any)
          .from("purchase_requisitions")
          .select("id", { count: "exact", head: true })
          .in("status", ["submitted", "pending_second_approval"])
      : Promise.resolve({ count: 0 }),
    isApprover
      ? (supabase as any).from("pr_item_edit_logs").select("pr_id").limit(200)
      : Promise.resolve({ data: [] }),
    isFinance
      ? (supabase as any)
          .from("payment_evidences")
          .select("id", { count: "exact", head: true })
          .eq("status", "submitted")
      : Promise.resolve({ count: 0 }),
    countIncompleteDocs(supabase, user.id),
    (supabase as any)
      .from("purchase_requisitions")
      .select("id", { count: "exact", head: true })
      .eq("requester_id", user.id)
      .in("status", ["draft", "returned", "rejected", "approved", "converted"]),
  ]);

  const approvalCount = approvalRes.count ?? 0;
  const editedCount = new Set(((editedRes.data ?? []) as any[]).map((r) => r.pr_id)).size;
  const verifyCount = verifyRes.count ?? 0;
  const todoCount = todoRes.count ?? 0;

  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar role={profile.role} approvalCount={approvalCount} editedCount={editedCount} verifyCount={verifyCount} incompleteCount={incompleteCount} todoCount={todoCount} />
      <div className="flex flex-1 flex-col min-w-0">
        <Navbar profile={profile} avatarUrl={avatarUrl} />
        <main className="flex-1 px-4 py-6 pb-24 lg:pb-6 lg:px-6">
          {children}
        </main>
        <MobileNav
          role={profile.role as import("@/types/database").UserRole}
          approvalCount={approvalCount}
          verifyCount={verifyCount}
          incompleteCount={incompleteCount}
          todoCount={todoCount}
        />
      </div>
      {/* Real-time toast notifications — ไม่กระทบ layout เดิม */}
      <RealtimeNotificationProvider userId={user.id} role={profile.role as import("@/types/database").UserRole} />
    </div>
  );
}
