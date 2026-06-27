export const dynamic = "force-dynamic";

import { createClient } from "@/lib/supabase/server";
import { formatCurrency } from "@/lib/utils/format";
import Link from "next/link";
import { Plus } from "lucide-react";

export default async function ProductsPage() {
  const supabase = await createClient();
  const { data: products } = await supabase
    .from("products")
    .select("*, categories(name)")
    .eq("is_active", true)
    .order("sku");

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-800">สินค้า</h1>
          <p className="text-sm text-slate-500">แคตตาล็อกสินค้าและบริการ</p>
        </div>
        <Link
          href="/products/new"
          className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-blue-700"
        >
          <Plus size={16} />
          เพิ่มสินค้า
        </Link>
      </div>

      {products && products.length > 0 ? (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="min-w-full text-sm">
            <thead className="border-b border-slate-100 bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-slate-500">SKU</th>
                <th className="px-4 py-3 text-left font-medium text-slate-500">ชื่อสินค้า</th>
                <th className="px-4 py-3 text-left font-medium text-slate-500 hidden md:table-cell">หมวดหมู่</th>
                <th className="px-4 py-3 text-left font-medium text-slate-500 hidden sm:table-cell">หน่วย</th>
                <th className="px-4 py-3 text-right font-medium text-slate-500">ราคา</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {products.map((p) => (
                <tr key={p.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-mono text-xs text-slate-500">{p.sku}</td>
                  <td className="px-4 py-3 font-medium text-slate-800">{p.name}</td>
                  <td className="px-4 py-3 text-slate-500 hidden md:table-cell">
                    {(p.categories as unknown as { name: string } | null)?.name ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-slate-500 hidden sm:table-cell">{p.unit}</td>
                  <td className="px-4 py-3 text-right font-medium text-slate-800">
                    {formatCurrency(p.unit_price)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/products/${p.id}`}
                      className="text-xs text-blue-600 hover:underline"
                    >
                      แก้ไข
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white py-16 text-center">
          <p className="text-slate-500">ยังไม่มีข้อมูลสินค้า</p>
          <Link
            href="/products/new"
            className="mt-3 inline-flex items-center gap-1 text-sm text-blue-600 hover:underline"
          >
            <Plus size={14} /> เพิ่มสินค้าแรก
          </Link>
        </div>
      )}
    </div>
  );
}
