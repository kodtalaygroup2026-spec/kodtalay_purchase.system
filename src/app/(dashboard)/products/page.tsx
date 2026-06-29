export const dynamic = "force-dynamic";

import { createClient } from "@/lib/supabase/server";
import { ProductList, type ProductRow } from "@/components/product/ProductList";
import Link from "next/link";
import { Plus } from "lucide-react";

export default async function ProductsPage() {
  const supabase = await createClient();
  const { data: products } = await supabase
    .from("products")
    .select("id, sku, name, unit, unit_price, categories(name)")
    .eq("is_active", true)
    .order("sku");

  const rows: ProductRow[] = ((products ?? []) as any[]).map((p: any) => ({
    id: p.id,
    sku: p.sku,
    name: p.name,
    unit: p.unit,
    unit_price: p.unit_price,
    category_name: (p.categories as { name: string } | null)?.name ?? null,
  }));

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

      {rows.length > 0 ? (
        <ProductList products={rows} />
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
