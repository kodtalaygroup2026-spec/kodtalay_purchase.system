export const dynamic = "force-dynamic";

import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { Plus, Phone, Mail } from "lucide-react";

export default async function SuppliersPage() {
  const supabase = await createClient();
  const { data: suppliers } = await supabase
    .from("suppliers")
    .select("*")
    .eq("is_active", true)
    .order("code");

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-800">ผู้ขาย</h1>
          <p className="text-sm text-slate-500">จัดการข้อมูลคู่ค้าและผู้จัดจำหน่าย</p>
        </div>
        <Link
          href="/suppliers/new"
          className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-blue-700"
        >
          <Plus size={16} />
          เพิ่มผู้ขาย
        </Link>
      </div>

      {suppliers && suppliers.length > 0 ? (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="min-w-full text-sm">
            <thead className="border-b border-slate-100 bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-slate-500">รหัส</th>
                <th className="px-4 py-3 text-left font-medium text-slate-500">ชื่อผู้ขาย</th>
                <th className="px-4 py-3 text-left font-medium text-slate-500 hidden md:table-cell">ผู้ติดต่อ</th>
                <th className="px-4 py-3 text-left font-medium text-slate-500 hidden lg:table-cell">ช่องทาง</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {suppliers.map((s) => (
                <tr key={s.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-mono text-xs text-slate-500">{s.code}</td>
                  <td className="px-4 py-3">
                    <p className="font-medium text-slate-800">{s.name}</p>
                    {s.tax_id && (
                      <p className="text-xs text-slate-400">เลขภาษี: {s.tax_id}</p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-600 hidden md:table-cell">
                    {s.contact_name ?? "—"}
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell">
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
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/suppliers/${s.id}`}
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
          <p className="text-slate-500">ยังไม่มีข้อมูลผู้ขาย</p>
          <Link
            href="/suppliers/new"
            className="mt-3 inline-flex items-center gap-1 text-sm text-blue-600 hover:underline"
          >
            <Plus size={14} /> เพิ่มผู้ขายแรก
          </Link>
        </div>
      )}
    </div>
  );
}
