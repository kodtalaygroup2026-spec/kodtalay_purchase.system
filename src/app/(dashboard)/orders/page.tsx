import { createClient } from "@/lib/supabase/server";
import { formatCurrency, formatDate } from "@/lib/utils/format";
import { StatusBadge } from "@/components/ui/StatusBadge";
import Link from "next/link";
import { Plus } from "lucide-react";
import type { PoStatus } from "@/types/database";

export default async function OrdersPage() {
  const supabase = await createClient();
  const { data: pos } = await supabase
    .from("purchase_orders")
    .select(
      `id, po_number, status, order_date, total_amount,
       suppliers(name),
       profiles!created_by(full_name)`
    )
    .order("created_at", { ascending: false });

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-800">ใบสั่งซื้อ (PO)</h1>
          <p className="text-sm text-slate-500">รายการใบสั่งซื้อทั้งหมด</p>
        </div>
        <Link
          href="/orders/new"
          className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-blue-700"
        >
          <Plus size={16} />
          สร้าง PO
        </Link>
      </div>

      {pos && pos.length > 0 ? (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="min-w-full text-sm">
            <thead className="border-b border-slate-100 bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-slate-500">เลขที่ PO</th>
                <th className="px-4 py-3 text-left font-medium text-slate-500">ผู้ขาย</th>
                <th className="px-4 py-3 text-left font-medium text-slate-500 hidden md:table-cell">วันที่สั่ง</th>
                <th className="px-4 py-3 text-right font-medium text-slate-500">มูลค่า</th>
                <th className="px-4 py-3 text-center font-medium text-slate-500">สถานะ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {pos.map((po) => {
                const supplier = po.suppliers as unknown as { name: string } | null;
                return (
                  <tr key={po.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <Link
                        href={`/orders/${po.id}`}
                        className="font-mono text-xs font-semibold text-blue-600 hover:underline"
                      >
                        {po.po_number}
                      </Link>
                    </td>
                    <td className="px-4 py-3 font-medium text-slate-800">
                      {supplier?.name ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-slate-500 hidden md:table-cell">
                      {formatDate(po.order_date)}
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-slate-800">
                      {formatCurrency(po.total_amount)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <StatusBadge kind="po" status={po.status as PoStatus} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white py-16 text-center">
          <p className="text-slate-500">ยังไม่มีใบสั่งซื้อ</p>
        </div>
      )}
    </div>
  );
}
