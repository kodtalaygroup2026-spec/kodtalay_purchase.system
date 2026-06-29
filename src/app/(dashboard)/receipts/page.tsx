export const dynamic = "force-dynamic";

import { createClient } from "@/lib/supabase/server";
import { ReceiptList, type ReceiptRow } from "@/components/receipt/ReceiptList";

export default async function ReceiptsPage() {
  const supabase = await createClient();
  const { data: receipts } = await supabase
    .from("goods_receipts")
    .select(
      `id, gr_number, received_date, note,
       purchase_orders(po_number, suppliers(name))`
    )
    .order("received_date", { ascending: false });

  const rows: ReceiptRow[] = ((receipts ?? []) as any[]).map((gr: any) => {
    const po = gr.purchase_orders as { po_number: string; suppliers: { name: string } | null } | null;
    return {
      id: gr.id,
      gr_number: gr.gr_number,
      received_date: gr.received_date,
      note: gr.note ?? null,
      po_number: po?.po_number ?? null,
      vendor_name: po?.suppliers?.name ?? null,
    };
  });

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-slate-800">รับของ (GR)</h1>
        <p className="text-sm text-slate-500">บันทึกการรับสินค้าตามใบสั่งซื้อ</p>
      </div>

      {rows.length > 0 ? (
        <ReceiptList receipts={rows} />
      ) : (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white py-16 text-center">
          <p className="text-slate-500">ยังไม่มีรายการรับของ</p>
        </div>
      )}
    </div>
  );
}
