"use client";

import Link from "next/link";
import { Phone, Mail } from "lucide-react";
import { SortTh, useSortable } from "@/components/shared/SortTh";

export interface SupplierRow {
  id: string;
  code: string;
  name: string;
  tax_id: string | null;
  contact_name: string | null;
  phone: string | null;
  email: string | null;
}

export function SupplierList({ suppliers }: { suppliers: SupplierRow[] }) {
  const { sorted, sortKey, sortDir, handleSort } = useSortable(suppliers, "code");

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="border-b border-slate-100 bg-slate-50">
            <tr>
              <SortTh label="รหัส"       col="code"         activeCol={sortKey} dir={sortDir} onSort={handleSort} />
              <SortTh label="ชื่อผู้ขาย" col="name"         activeCol={sortKey} dir={sortDir} onSort={handleSort} />
              <SortTh label="ผู้ติดต่อ"  col="contact_name" activeCol={sortKey} dir={sortDir} onSort={handleSort} />
              <th className="px-4 py-3 text-left font-medium text-slate-500">ช่องทาง</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {sorted.map((s) => (
              <tr key={s.id} className="hover:bg-slate-50">
                <td className="px-4 py-3 font-mono text-xs text-slate-500 whitespace-nowrap">{s.code}</td>
                <td className="px-4 py-3 min-w-[160px]">
                  <p className="font-medium text-slate-800">{s.name}</p>
                  {s.tax_id && (
                    <p className="text-xs text-slate-400">เลขภาษี: {s.tax_id}</p>
                  )}
                </td>
                <td className="px-4 py-3 text-slate-600 whitespace-nowrap">
                  {s.contact_name ?? "—"}
                </td>
                <td className="px-4 py-3 min-w-[140px]">
                  <div className="flex flex-col gap-0.5">
                    {s.phone && (
                      <span className="flex items-center gap-1 text-xs text-slate-500">
                        <Phone size={12} /> {s.phone}
                      </span>
                    )}
                    {s.email && (
                      <span className="flex items-center gap-1 text-xs text-slate-500">
                        <Mail size={12} /> {s.email}
                      </span>
                    )}
                    {!s.phone && !s.email && <span className="text-xs text-slate-300">—</span>}
                  </div>
                </td>
                <td className="px-4 py-3 text-right">
                  <Link href={`/suppliers/${s.id}`} className="text-xs text-blue-600 hover:underline">
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
