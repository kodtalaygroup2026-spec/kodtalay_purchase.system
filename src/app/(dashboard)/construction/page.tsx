import { createClient } from "@/lib/supabase/server";
import { formatCurrency, formatDate } from "@/lib/utils/format";
import { StatusBadge } from "@/components/ui/StatusBadge";
import Link from "next/link";
import { Plus, HardHat } from "lucide-react";
import type { ConstructionStatus } from "@/types/database";

export default async function ConstructionPage() {
  const supabase = await createClient();
  const { data: tickets } = await (supabase as any)
    .from("construction_tickets")
    .select("id, ticket_number, title, location, status, boq_total, created_at, profiles!requester_id(full_name)")
    .order("created_at", { ascending: false });

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-800">งานก่อสร้าง</h1>
          <p className="text-sm text-slate-500">รายการงานก่อสร้างทั้งหมด</p>
        </div>
        <Link
          href="/construction/new"
          className="flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-violet-700"
        >
          <Plus size={16} />
          เปิดงานใหม่
        </Link>
      </div>

      {tickets && tickets.length > 0 ? (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="min-w-full text-sm">
            <thead className="border-b border-slate-100 bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-slate-500">เลขที่</th>
                <th className="px-4 py-3 text-left font-medium text-slate-500">ชื่องาน</th>
                <th className="px-4 py-3 text-left font-medium text-slate-500 hidden md:table-cell">สถานที่</th>
                <th className="px-4 py-3 text-left font-medium text-slate-500 hidden lg:table-cell">ผู้เปิด</th>
                <th className="px-4 py-3 text-left font-medium text-slate-500 hidden lg:table-cell">วันที่</th>
                <th className="px-4 py-3 text-right font-medium text-slate-500">ยอด BOQ</th>
                <th className="px-4 py-3 text-center font-medium text-slate-500">สถานะ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {tickets.map((t: any) => {
                const requester = t.profiles as { full_name: string } | null;
                return (
                  <tr key={t.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <Link
                        href={`/construction/${t.id}`}
                        className="font-mono text-xs font-semibold text-violet-600 hover:underline"
                      >
                        {t.ticket_number}
                      </Link>
                    </td>
                    <td className="px-4 py-3 max-w-[200px]">
                      <Link
                        href={`/construction/${t.id}`}
                        className="font-medium text-slate-800 hover:text-violet-600 truncate block"
                      >
                        {t.title}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-slate-500 hidden md:table-cell">
                      {t.location ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-slate-500 hidden lg:table-cell">
                      {requester?.full_name ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-slate-500 hidden lg:table-cell">
                      {formatDate(t.created_at)}
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-slate-800">
                      {formatCurrency(t.boq_total)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <StatusBadge kind="construction" status={t.status as ConstructionStatus} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white py-20 text-center">
          <HardHat size={40} className="mx-auto mb-3 text-slate-300" />
          <p className="text-slate-500">ยังไม่มีงานก่อสร้าง</p>
          <Link
            href="/construction/new"
            className="mt-4 inline-flex items-center gap-1 text-sm text-violet-600 hover:underline"
          >
            <Plus size={14} /> เปิดงานแรก
          </Link>
        </div>
      )}
    </div>
  );
}
