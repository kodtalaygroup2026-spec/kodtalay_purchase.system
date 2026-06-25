import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { formatCurrency, formatDate } from "@/lib/utils/format";
import { StatusBadge } from "@/components/ui/StatusBadge";
import Link from "next/link";
import type { PrStatus } from "@/types/database";

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

  const { data: pendingPRs } = await supabase
    .from("purchase_requisitions")
    .select(
      `id, pr_number, title, status, total_amount, created_at,
       profiles!requester_id(full_name, department)`
    )
    .eq("status", "submitted")
    .order("created_at");

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-slate-800">รายการรออนุมัติ</h1>
        <p className="text-sm text-slate-500">
          ใบขอซื้อที่รอการพิจารณา — {pendingPRs?.length ?? 0} รายการ
        </p>
      </div>

      {pendingPRs && pendingPRs.length > 0 ? (
        <div className="space-y-3">
          {pendingPRs.map((pr) => {
            const requester = pr.profiles as unknown as {
              full_name: string;
              department: string | null;
            } | null;
            return (
              <div
                key={pr.id}
                className="flex items-center justify-between rounded-xl border border-amber-200 bg-amber-50 px-5 py-4"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Link
                      href={`/requisitions/${pr.id}`}
                      className="font-mono text-xs font-bold text-amber-700 hover:underline"
                    >
                      {pr.pr_number}
                    </Link>
                    <StatusBadge kind="pr" status={pr.status as PrStatus} />
                  </div>
                  <Link
                    href={`/requisitions/${pr.id}`}
                    className="font-semibold text-slate-800 hover:text-blue-600"
                  >
                    {pr.title}
                  </Link>
                  <p className="text-sm text-slate-500">
                    โดย {requester?.full_name ?? "—"}
                    {requester?.department && ` · ${requester.department}`}
                    {" · "}
                    {formatDate(pr.created_at)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-bold text-slate-800">{formatCurrency(pr.total_amount)}</p>
                  <Link
                    href={`/requisitions/${pr.id}`}
                    className="mt-1 inline-block rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-700"
                  >
                    พิจารณา →
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white py-16 text-center">
          <p className="text-slate-500">ไม่มีรายการรออนุมัติ</p>
        </div>
      )}
    </div>
  );
}
