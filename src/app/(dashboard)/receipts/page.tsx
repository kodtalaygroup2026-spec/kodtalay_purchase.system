import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/utils/format";

export default async function ReceiptsPage() {
  const supabase = await createClient();
  const { data: receipts } = await supabase
    .from("goods_receipts")
    .select(
      `id, gr_number, received_date, note,
       purchase_orders(po_number, suppliers(name))`
    )
    .order("received_date", { ascending: false });

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-slate-800">รับของ (GR)</h1>
        <p className="text-sm text-slate-500">บันทึกการรับสินค้าตามใบสั่งซื้อ</p>
      </div>

      {receipts && receipts.length > 0 ? (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="min-w-full text-sm">
            <thead className="border-b border-slate-100 bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-slate-500">เลขที่ GR</th>
                <th className="px-4 py-3 text-left font-medium text-slate-500">อ้างอิง PO</th>
                <th className="px-4 py-3 text-left font-medium text-slate-500 hidden md:table-cell">ผู้ขาย</th>
                <th className="px-4 py-3 text-left font-medium text-slate-500">วันที่รับ</th>
                <th className="px-4 py-3 text-left font-medium text-slate-500 hidden lg:table-cell">หมายเหตุ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {receipts.map((gr) => {
                const po = gr.purchase_orders as unknown as {
                  po_number: string;
                  suppliers: { name: string } | null;
                } | null;
                return (
                  <tr key={gr.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-mono text-xs font-semibold text-blue-600">
                      {gr.gr_number}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-500">
                      {po?.po_number ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-slate-700 hidden md:table-cell">
                      {po?.suppliers?.name ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                      {formatDate(gr.received_date)}
                    </td>
                    <td className="px-4 py-3 text-slate-500 hidden lg:table-cell">
                      {gr.note ?? "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white py-16 text-center">
          <p className="text-slate-500">ยังไม่มีรายการรับของ</p>
        </div>
      )}
    </div>
  );
}
