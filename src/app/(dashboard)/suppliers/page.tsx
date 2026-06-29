export const dynamic = "force-dynamic";

import { createClient } from "@/lib/supabase/server";
import { SupplierList, type SupplierRow } from "@/components/supplier/SupplierList";
import Link from "next/link";
import { Plus } from "lucide-react";

export default async function SuppliersPage() {
  const supabase = await createClient();
  const { data: suppliers } = await supabase
    .from("suppliers")
    .select("id, code, name, tax_id, contact_name, phone, email")
    .eq("is_active", true)
    .order("code");

  const rows: SupplierRow[] = ((suppliers ?? []) as any[]).map((s: any) => ({
    id: s.id,
    code: s.code,
    name: s.name,
    tax_id: s.tax_id ?? null,
    contact_name: s.contact_name ?? null,
    phone: s.phone ?? null,
    email: s.email ?? null,
  }));

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

      {rows.length > 0 ? (
        <SupplierList suppliers={rows} />
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
