import { createClient } from "@/lib/supabase/server";
import { formatCurrency, formatDate } from "@/lib/utils/format";
import { StatusBadge } from "@/components/ui/StatusBadge";
import Link from "next/link";
import { Receipt } from "lucide-react";
import type { PaymentRequestStatus } from "@/types/database";

export default async function ConstructionPaymentsPage() {
  const supabase = await createClient();
  const { data: payments } = await (supabase as any)
    .from("construction_payment_requests")
    .select(`
      id, request_number, amount, status, created_at,
      construction_tickets!ticket_id(id, ticket_number, title)
    `)
    .order("created_at", { ascending: false });

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-slate-800">ขอเบิก / ตรวจรับงาน</h1>
        <p className="text-sm text-slate-500">รายการขอเบิกและตรวจรับงานก่อสร้าง</p>
      </div>

      {payments && payments.length > 0 ? (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="min-w-full text-sm">
            <thead className="border-b border-slate-100 bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-slate-500">เลขที่</th>
                <th className="px-4 py-3 text-left font-medium text-slate-500">งาน</th>
                <th className="px-4 py-3 text-left font-medium text-slate-500 hidden lg:table-cell">วันที่</th>
                <th className="px-4 py-3 text-right font-medium text-slate-500">ยอด</th>
                <th className="px-4 py-3 text-center font-medium text-slate-500">สถานะ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {payments.map((p: any) => {
                const ticket = p.construction_tickets as { id: string; ticket_number: string; title: string } | null;
                return (
                  <tr key={p.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-mono text-xs font-semibold text-violet-600">
                      {p.request_number}
                    </td>
                    <td className="px-4 py-3 max-w-[200px]">
                      {ticket ? (
                        <Link
                          href={`/construction/${ticket.id}`}
                          className="font-medium text-slate-800 hover:text-violet-600 truncate block"
                        >
                          {ticket.title}
                        </Link>
                      ) : "—"}
                    </td>
                    <td className="px-4 py-3 text-slate-500 hidden lg:table-cell">
                      {formatDate(p.created_at)}
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-slate-800">
                      {formatCurrency(p.amount)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <StatusBadge kind="payment" status={p.status as PaymentRequestStatus} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white py-20 text-center">
          <Receipt size={40} className="mx-auto mb-3 text-slate-300" />
          <p className="text-slate-500">ยังไม่มีรายการขอเบิก</p>
          <p className="mt-1 text-xs text-slate-400">เมื่อ BOQ ได้รับอนุมัติแล้ว จะสามารถขอเบิกได้จากหน้างาน</p>
        </div>
      )}
    </div>
  );
}
