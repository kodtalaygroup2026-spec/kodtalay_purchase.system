"use client";

import { formatDate } from "@/lib/utils/format";
import { SortTh, useSortable } from "@/components/shared/SortTh";

export interface ReceiptRow {
  id: string;
  gr_number: string;
  received_date: string;
  note: string | null;
  po_number: string | null;
  vendor_name: string | null;
}

export function ReceiptList({ receipts }: { receipts: ReceiptRow[] }) {
  const { sorted, sortKey, sortDir, handleSort } = useSortable(receipts, "received_date", "desc");

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="border-b border-slate-100 bg-slate-50">
            <tr>
              <SortTh label="เลขที่ GR"  col="gr_number"     activeCol={sortKey} dir={sortDir} onSort={handleSort} />
              <SortTh label="อ้างอิง PO" col="po_number"     activeCol={sortKey} dir={sortDir} onSort={handleSort} />
              <SortTh label="ผู้ขาย"     col="vendor_name"   activeCol={sortKey} dir={sortDir} onSort={handleSort} />
              <SortTh label="วันที่รับ"  col="received_date" activeCol={sortKey} dir={sortDir} onSort={handleSort} />
              <th className="px-4 py-3 text-left font-medium text-slate-500">หมายเหตุ</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {sorted.map((gr) => (
              <tr key={gr.id} className="hover:bg-slate-50">
                <td className="px-4 py-3 font-mono text-xs font-semibold text-blue-600">
                  {gr.gr_number}
                </td>
                <td className="px-4 py-3 font-mono text-xs text-slate-500">
                  {gr.po_number ?? "—"}
                </td>
                <td className="px-4 py-3 text-slate-700 whitespace-nowrap">
                  {gr.vendor_name ?? "—"}
                </td>
                <td className="px-4 py-3 text-slate-700 whitespace-nowrap">
                  {formatDate(gr.received_date)}
                </td>
                <td className="px-4 py-3 text-slate-500 min-w-[160px]">
                  {gr.note ?? "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
