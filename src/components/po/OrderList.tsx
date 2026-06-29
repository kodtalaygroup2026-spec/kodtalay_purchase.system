"use client";

import Link from "next/link";
import { formatCurrency, formatDate } from "@/lib/utils/format";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { SortTh, useSortable } from "@/components/shared/SortTh";
import type { PoStatus } from "@/types/database";

export interface OrderRow {
  id: string;
  po_number: string;
  status: PoStatus;
  order_date: string;
  total_amount: number;
  vendor_name: string | null;
}

export function OrderList({ orders }: { orders: OrderRow[] }) {
  const { sorted, sortKey, sortDir, handleSort } = useSortable(orders, "order_date", "desc");

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <table className="min-w-full text-sm">
        <thead className="border-b border-slate-100 bg-slate-50">
          <tr>
            <SortTh label="เลขที่ PO"  col="po_number"    activeCol={sortKey} dir={sortDir} onSort={handleSort} />
            <SortTh label="ผู้ขาย"     col="vendor_name"  activeCol={sortKey} dir={sortDir} onSort={handleSort} />
            <SortTh label="วันที่สั่ง" col="order_date"   activeCol={sortKey} dir={sortDir} onSort={handleSort} className="hidden md:table-cell" />
            <SortTh label="มูลค่า"     col="total_amount" activeCol={sortKey} dir={sortDir} onSort={handleSort} align="right" />
            <th className="px-4 py-3 text-center font-medium text-slate-500">สถานะ</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {sorted.map((po) => (
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
                {po.vendor_name ?? "—"}
              </td>
              <td className="px-4 py-3 text-slate-500 hidden md:table-cell">
                {formatDate(po.order_date)}
              </td>
              <td className="px-4 py-3 text-right font-medium text-slate-800">
                {formatCurrency(po.total_amount)}
              </td>
              <td className="px-4 py-3 text-center">
                <StatusBadge kind="po" status={po.status} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
