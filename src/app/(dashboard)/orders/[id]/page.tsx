import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { formatCurrency, formatDate } from "@/lib/utils/format";
import { StatusBadge } from "@/components/ui/StatusBadge";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import type { PoStatus } from "@/types/database";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function OrderDetailPage({ params }: PageProps) {
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: po }, { data: items }] = await Promise.all([
    supabase
      .from("purchase_orders")
      .select(
        `*, suppliers(name, code, contact_name, phone, email),
         profiles!created_by(full_name),
         purchase_requisitions(pr_number, title)`
      )
      .eq("id", id)
      .single(),
    supabase
      .from("po_items")
      .select(`*, products(name, sku)`)
      .eq("po_id", id)
      .order("line_no"),
  ]);

  if (!po) notFound();

  const supplier = po.suppliers as unknown as { name: string; code: string; contact_name: string | null; phone: string | null } | null;
  const pr = po.purchase_requisitions as unknown as { pr_number: string; title: string } | null;

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div className="flex items-center gap-3">
        <Link href="/orders" className="text-slate-400 hover:text-slate-600">
          <ArrowLeft size={20} />
        </Link>
        <div>
          <div className="flex items-center gap-2">
            <span className="font-mono text-sm font-bold text-slate-500">{po.po_number}</span>
            <StatusBadge kind="po" status={po.status as PoStatus} />
          </div>
          <h1 className="text-xl font-bold text-slate-800">
            ใบสั่งซื้อ — {supplier?.name ?? "—"}
          </h1>
        </div>
      </div>

      {/* ข้อมูล PO */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h3 className="mb-4 font-semibold text-slate-700">ข้อมูลทั่วไป</h3>
        <div className="grid grid-cols-2 gap-x-8 gap-y-3 text-sm">
          <div>
            <p className="text-slate-500">ผู้ขาย</p>
            <p className="font-medium text-slate-800">{supplier?.name ?? "—"}</p>
            {supplier?.contact_name && (
              <p className="text-xs text-slate-400">ติดต่อ: {supplier.contact_name}</p>
            )}
          </div>
          <div>
            <p className="text-slate-500">อ้างอิง PR</p>
            {pr ? (
              <Link
                href={`/requisitions/${po.pr_id}`}
                className="font-medium text-blue-600 hover:underline"
              >
                {pr.pr_number}
              </Link>
            ) : (
              <p className="text-slate-400">—</p>
            )}
          </div>
          <div>
            <p className="text-slate-500">วันที่สั่ง</p>
            <p className="font-medium text-slate-800">{formatDate(po.order_date)}</p>
          </div>
          <div>
            <p className="text-slate-500">วันที่ต้องการรับ</p>
            <p className="font-medium text-slate-800">
              {po.expected_date ? formatDate(po.expected_date) : "—"}
            </p>
          </div>
          {po.note && (
            <div className="col-span-2">
              <p className="text-slate-500">หมายเหตุ</p>
              <p className="font-medium text-slate-800">{po.note}</p>
            </div>
          )}
        </div>
      </div>

      {/* รายการสินค้า */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-6 py-4">
          <h3 className="font-semibold text-slate-700">รายการสินค้า</h3>
        </div>
        <table className="min-w-full text-sm">
          <thead className="border-b border-slate-100 bg-slate-50">
            <tr>
              <th className="px-4 py-2 text-left font-medium text-slate-500">#</th>
              <th className="px-4 py-2 text-left font-medium text-slate-500">สินค้า</th>
              <th className="px-4 py-2 text-right font-medium text-slate-500">สั่ง</th>
              <th className="px-4 py-2 text-right font-medium text-slate-500">รับแล้ว</th>
              <th className="px-4 py-2 text-left font-medium text-slate-500">หน่วย</th>
              <th className="px-4 py-2 text-right font-medium text-slate-500">ราคา/หน่วย</th>
              <th className="px-4 py-2 text-right font-medium text-slate-500">รวม</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {(items ?? []).map((item) => {
              const product = item.products as unknown as { name: string; sku: string } | null;
              return (
                <tr key={item.id}>
                  <td className="px-4 py-2 text-slate-400">{item.line_no}</td>
                  <td className="px-4 py-2">
                    <p className="font-medium text-slate-800">{item.description}</p>
                    {product && (
                      <p className="text-xs text-slate-400">{product.sku}</p>
                    )}
                  </td>
                  <td className="px-4 py-2 text-right text-slate-700">{item.quantity}</td>
                  <td className="px-4 py-2 text-right text-slate-700">
                    {item.received_qty ?? 0}
                  </td>
                  <td className="px-4 py-2 text-slate-500">{item.unit}</td>
                  <td className="px-4 py-2 text-right text-slate-700">
                    {formatCurrency(item.unit_price)}
                  </td>
                  <td className="px-4 py-2 text-right font-medium text-slate-800">
                    {formatCurrency(item.line_total ?? item.quantity * item.unit_price)}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot className="border-t border-slate-200 bg-slate-50">
            <tr>
              <td colSpan={6} className="px-4 py-2 text-right text-sm text-slate-500">
                ราคาก่อน VAT
              </td>
              <td className="px-4 py-2 text-right text-slate-700">{formatCurrency(po.subtotal)}</td>
            </tr>
            <tr>
              <td colSpan={6} className="px-4 py-2 text-right text-sm text-slate-500">
                VAT {po.vat_rate}%
              </td>
              <td className="px-4 py-2 text-right text-slate-700">{formatCurrency(po.vat_amount)}</td>
            </tr>
            <tr>
              <td colSpan={6} className="px-4 py-3 text-right font-semibold text-slate-700">
                รวมทั้งสิ้น
              </td>
              <td className="px-4 py-3 text-right font-bold text-slate-900">
                {formatCurrency(po.total_amount)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
