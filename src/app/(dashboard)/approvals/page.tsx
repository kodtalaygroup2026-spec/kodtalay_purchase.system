export const dynamic = "force-dynamic";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { ApprovalList, type PRApprovalRow } from "@/components/pr/ApprovalList";

export default async function ApprovalsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  const isApprover =
    profile?.role === "manager" || profile?.role === "admin";

  if (!isApprover) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white py-16 text-center">
        <p className="text-slate-500">คุณไม่มีสิทธิ์เข้าถึงหน้านี้</p>
      </div>
    );
  }

  const { data: pendingPRs } = await (supabase as any)
    .from("purchase_requisitions")
    .select(
      `id, pr_number, title, status, total_amount, created_at, requester_id,
       profiles!requester_id(full_name, department, line_user_id)`
    )
    .eq("status", "submitted")
    .order("created_at");

  const prList: PRApprovalRow[] = ((pendingPRs ?? []) as any[]).map((pr) => ({
    id: pr.id,
    pr_number: pr.pr_number,
    title: pr.title,
    status: pr.status,
    total_amount: pr.total_amount,
    created_at: pr.created_at,
    requester_id: pr.requester_id,
    requester_name: pr.profiles?.full_name ?? "—",
    requester_line_id: pr.profiles?.line_user_id ?? null,
    department: pr.profiles?.department ?? null,
  }));

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-slate-800">รายการรออนุมัติ</h1>
        <p className="text-sm text-slate-500">
          ใบขอซื้อที่รอการพิจารณา — {prList.length} รายการ
        </p>
      </div>

      {prList.length > 0 ? (
        <ApprovalList prs={prList} currentUserId={user.id} />
      ) : (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white py-16 text-center">
          <p className="text-slate-500">ไม่มีรายการรออนุมัติ</p>
        </div>
      )}
    </div>
  );
}
