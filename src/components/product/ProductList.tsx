"use client";

import Link from "next/link";
import { formatCurrency } from "@/lib/utils/format";
import { SortTh, useSortable } from "@/components/shared/SortTh";

export interface ProductRow {
  id: string;
  sku: string;
  name: string;
  unit: string;
  unit_price: number;
  category_name: string | null;
}

export function ProductList({ products }: { products: ProductRow[] }) {
  const { sorted, sortKey, sortDir, handleSort } = useSortable(products, "sku");

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="border-b border-slate-100 bg-slate-50">
            <tr>
              <SortTh label="SKU"        col="sku"           activeCol={sortKey} dir={sortDir} onSort={handleSort} />
              <SortTh label="ชื่อสินค้า" col="name"          activeCol={sortKey} dir={sortDir} onSort={handleSort} />
              <SortTh label="หมวดหมู่"   col="category_name" activeCol={sortKey} dir={sortDir} onSort={handleSort} />
              <SortTh label="หน่วย"      col="unit"          activeCol={sortKey} dir={sortDir} onSort={handleSort} />
              <SortTh label="ราคา"       col="unit_price"    activeCol={sortKey} dir={sortDir} onSort={handleSort} align="right" />
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {sorted.map((p) => (
              <tr key={p.id} className="hover:bg-slate-50">
                <td className="px-4 py-3 font-mono text-xs text-slate-500 whitespace-nowrap">{p.sku}</td>
                <td className="px-4 py-3 font-medium text-slate-800">{p.name}</td>
                <td className="px-4 py-3 text-slate-500 whitespace-nowrap">
                  {p.category_name ?? "—"}
                </td>
                <td className="px-4 py-3 text-slate-500 whitespace-nowrap">{p.unit}</td>
                <td className="px-4 py-3 text-right font-medium text-slate-800 whitespace-nowrap">
                  {formatCurrency(p.unit_price)}
                </td>
                <td className="px-4 py-3 text-right">
                  <Link href={`/products/${p.id}`} className="text-xs text-blue-600 hover:underline">
                    แก้ไข
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
