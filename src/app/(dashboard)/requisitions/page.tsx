import { createClient } from "@/lib/supabase/server";
import { formatCurrency, formatDate } from "@/lib/utils/format";
import { PR_STATUS_LABELS } from "@/lib/constants";
import { StatusBadge } from "@/components/ui/StatusBadge";
import Link from "next/link";
import { Plus } from "lucide-react";
import type { PrStatus } from "@/types/database";

export default async function RequisitionsPage() {
  const supabase = await createClient();
  const { data: prs } = await supabase
    .from("purchase_requisitions")
    .select(
      `id, pr_number, title, status, total_amount, created_at, needed_by,
       profiles!requester_id(full_name)`
    )
    .order("created_at", { ascending: false });

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-800">ใบขอซื้อ (PR)</h1>
          <p className="text-sm text-slate-500">รายการใบขอซื้อทั้งหมดในระบบ</p>
        </div>
        <Link
          href="/requisitions/new"
          className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-blue-700"
        >
          <Plus size={16} />
          สร้าง PR
        </Link>
      </div>

      {prs && prs.length > 0 ? (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="min-w-full text-sm">
            <thead className="border-b border-slate-100 bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-slate-500">เลขที่ PR</th>
                <th className="px-4 py-3 text-left font-medium text-slate-500">ชื่อ</th>
                <th className="px-4 py-3 text-left font-medium text-slate-500 hidden md:table-cell">ผู้ขอ</th>
                <th className="px-4 py-3 text-left font-medium text-slate-500 hidden lg:table-cell">วันที่ต้องการ</th>
                <th className="px-4 py-3 text-right font-medium text-slate-500">มูลค่า</th>
                <th className="px-4 py-3 text-center font-medium text-slate-500">สถานะ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {prs.map((pr) => {
                const requester = pr.profiles as unknown as { full_name: string } | null;
                return (
                  <tr key={pr.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <Link
                        href={`/requisitions/${pr.id}`}
                        className="font-mono text-xs font-semibold text-blue-600 hover:underline"
                      >
                        {pr.pr_number}
                      </Link>
                    </td>
                    <td className="px-4 py-3 max-w-[200px]">
                      <Link
                        href={`/requisitions/${pr.id}`}
                        className="font-medium text-slate-800 hover:text-blue-600 truncate block"
                      >
                        {pr.title}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-slate-500 hidden md:table-cell">
                      {requester?.full_name ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-slate-500 hidden lg:table-cell">
                      {pr.needed_by ? formatDate(pr.needed_by) : "—"}
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-slate-800">
                      {formatCurrency(pr.total_amount)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <StatusBadge kind="pr" status={pr.status as PrStatus} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white py-16 text-center">
          <p className="text-slate-500">ยังไม่มีใบขอซื้อ</p>
          <Link
            href="/requisitions/new"
            className="mt-3 inline-flex items-center gap-1 text-sm text-blue-600 hover:underline"
          >
            <Plus size={14} /> สร้างใบขอซื้อแรก
          </Link>
        </div>
      )}
    </div>
  );
}
