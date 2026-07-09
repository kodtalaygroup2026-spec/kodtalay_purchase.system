import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Sidebar } from "@/components/layout/Sidebar";
import { Navbar } from "@/components/layout/Navbar";
import { MobileNav } from "@/components/layout/MobileNav";
import { RealtimeNotificationProvider } from "@/components/shared/RealtimeNotificationProvider";

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

  // นับรายการที่รอการอนุมัติตาม role
  let approvalCount = 0;
  let editedCount = 0;
  if (profile.role === "manager" || profile.role === "admin") {
    const [{ count }, { data: editedPRIds }] = await Promise.all([
      (supabase as any)
        .from("purchase_requisitions")
        .select("id", { count: "exact", head: true })
        .in("status", ["submitted", "pending_second_approval"]),
      (supabase as any)
        .from("pr_item_edit_logs")
        .select("pr_id")
        .limit(200),
    ]);
    approvalCount = count ?? 0;
    editedCount = new Set(((editedPRIds ?? []) as any[]).map((r) => r.pr_id)).size;
  }

  // นับงานที่รอฝ่ายบัญชีตรวจสอบ (evidence status = submitted) — เฉพาะ finance/admin
  let verifyCount = 0;
  if (profile.role === "finance" || profile.role === "admin") {
    const { count } = await (supabase as any)
      .from("payment_evidences")
      .select("id", { count: "exact", head: true })
      .eq("status", "submitted");
    verifyCount = count ?? 0;
  }

  // นับเอกสารของตัวเองที่ไม่สมบูรณ์ — ทั้งที่ถูกตีกลับ และที่จ่ายแล้วแต่ค้างเอกสารตัวจริง
  // (ต้องเช็คสถานะ PR ด้วย เพราะใบที่ส่งหลักฐานใหม่ไปแล้วไม่ควรนับซ้ำ)
  const { data: incRows } = await (supabase as any)
    .from("payment_evidences")
    .select("pr_id, status, submitted_at")
    .eq("submitted_by", user.id)
    .eq("close_status", "incomplete")
    .order("submitted_at", { ascending: false })
    .limit(200);

  let incompleteCount = 0;
  if (incRows && incRows.length > 0) {
    const incPrIds = [...new Set(incRows.map((r: any) => r.pr_id))];
    const { data: incPrs } = await (supabase as any)
      .from("purchase_requisitions")
      .select("id, status")
      .in("id", incPrIds);
    const prStatusById: Record<string, string> = Object.fromEntries(
      (incPrs ?? []).map((p: any) => [p.id, p.status])
    );
    const seen = new Set<string>();
    for (const ev of incRows as any[]) {
      if (seen.has(ev.pr_id)) continue;
      seen.add(ev.pr_id);
      const prStatus = prStatusById[ev.pr_id];
      if (!prStatus) continue;
      const isPendingFix = ev.status === "returned" && ["approved", "converted"].includes(prStatus);
      const isAwaitingDocs = ev.status === "paid";
      if (isPendingFix || isAwaitingDocs) incompleteCount++;
    }
  }

  // นับ PR ของตัวเองที่ "เจ้าของต้องจัดการ" — ร่าง/ตีกลับ/ไม่อนุมัติ + รอแนบบิล
  const { count: todoCnt } = await (supabase as any)
    .from("purchase_requisitions")
    .select("id", { count: "exact", head: true })
    .eq("requester_id", user.id)
    .in("status", ["draft", "returned", "rejected", "approved", "converted"]);
  const todoCount = todoCnt ?? 0;

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
