export const dynamic = "force-dynamic";

import { createClient } from "@/lib/supabase/server";
import { OrderList, type OrderRow } from "@/components/po/OrderList";
import Link from "next/link";
import { Plus } from "lucide-react";

export default async function OrdersPage() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user!.id)
    .single();

  const isOverseer = profile?.role === "admin" || profile?.role === "manager";

  let query = (supabase as any)
    .from("purchase_orders")
    .select(`id, po_number, status, order_date, total_amount, vendor_name`)
    .order("created_at", { ascending: false });

  if (!isOverseer) {
    query = query.eq("created_by", user!.id);
  }

  const { data: pos } = await query;

  const orders: OrderRow[] = ((pos ?? []) as any[]).map((po: any) => ({
    id: po.id,
    po_number: po.po_number,
    status: po.status,
    order_date: po.order_date,
    total_amount: po.total_amount,
    vendor_name: po.vendor_name ?? null,
  }));

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

      {orders.length > 0 ? (
        <OrderList orders={orders} />
      ) : (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white py-16 text-center">
          <p className="text-slate-500">ยังไม่มีใบสั่งซื้อ</p>
        </div>
      )}
    </div>
  );
}
