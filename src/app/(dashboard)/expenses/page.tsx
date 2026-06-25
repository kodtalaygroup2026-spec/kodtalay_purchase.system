import { createClient } from "@/lib/supabase/server";
import { getExpenseList, getBranches } from "@/lib/expense/queries";
import { ExpenseStatusBadge } from "@/components/expense/ExpenseStatusBadge";
import { formatCurrency } from "@/lib/utils/format";
import Link from "next/link";
import { Plus } from "lucide-react";
import type { ExpenseStatus } from "@/types/database";

interface SearchParams {
  status?: string;
  branch_id?: string;
}

export default async function ExpensesPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: profile } = await (supabase as any)
    .from("profiles")
    .select("role")
    .eq("id", user!.id)
    .single();

  const isAdmin = profile?.role === "admin";

  const [expenses, branches] = await Promise.all([
    getExpenseList({
      status: searchParams.status,
      branch_id: searchParams.branch_id,
    }),
    isAdmin ? getBranches() : Promise.resolve([]),
  ]);

  const STATUS_LIST: { value: ExpenseStatus; label: string }[] = [
    { value: "submitted", label: "รออนุมัติ" },
    { value: "approved", label: "อนุมัติแล้ว" },
    { value: "paid", label: "จ่ายแล้ว" },
    { value: "rejected", label: "ไม่อนุมัติ" },
    { value: "draft", label: "ร่าง" },
    { value: "cancelled", label: "ยกเลิก" },
  ];

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-800">ใบเบิกค่าใช้จ่าย</h1>
          <p className="text-sm text-slate-500">{expenses.length} รายการ</p>
        </div>
        <Link
          href="/expenses/new"
          className="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700"
        >
          <Plus size={16} />
          สร้างใบเบิก
        </Link>
      </div>

      {/* Filter สถานะ */}
      <div className="flex flex-wrap gap-2">
        <FilterChip label="ทั้งหมด" href="/expenses" active={!searchParams.status} />
        {STATUS_LIST.map((s) => (
          <FilterChip
            key={s.value}
            label={s.label}
            href={`/expenses?status=${s.value}`}
            active={searchParams.status === s.value}
          />
        ))}
      </div>

      {/* Filter สาขา — แสดงเฉพาะ admin */}
      {isAdmin && branches.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <FilterChip
            label="ทุกบริษัท"
            href={searchParams.status ? `/expenses?status=${searchParams.status}` : "/expenses"}
            active={!searchParams.branch_id}
          />
          {branches.map((b) => (
            <FilterChip
              key={b.id}
              label={b.name}
              href={`/expenses?${searchParams.status ? `status=${searchParams.status}&` : ""}branch_id=${b.id}`}
              active={searchParams.branch_id === b.id}
            />
          ))}
        </div>
      )}

      {expenses.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white py-16 text-center text-sm text-slate-400 shadow-sm">
          ยังไม่มีใบเบิก
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="min-w-full text-sm">
            <thead className="border-b border-slate-100 bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-slate-500">เลขที่</th>
                <th className="px-4 py-3 text-left font-medium text-slate-500">ชื่อเรื่อง</th>
                {isAdmin && (
                  <th className="px-4 py-3 text-left font-medium text-slate-500">บริษัท</th>
                )}
                <th className="px-4 py-3 text-left font-medium text-slate-500">วันที่เบิก</th>
                <th className="px-4 py-3 text-right font-medium text-slate-500">ยอดรวม</th>
                <th className="px-4 py-3 text-center font-medium text-slate-500">สถานะ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {expenses.map((exp) => (
                <tr key={exp.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <Link
                      href={`/expenses/${exp.id}`}
                      className="font-mono text-xs text-blue-600 hover:underline"
                    >
                      {exp.request_number}
                    </Link>
                  </td>
                  <td className="max-w-[180px] truncate px-4 py-3 text-slate-700">
                    {exp.title}
                  </td>
                  {isAdmin && (
                    <td className="px-4 py-3 text-slate-500">
                      {exp.branch?.name ?? "-"}
                    </td>
                  )}
                  <td className="px-4 py-3 text-slate-500">
                    {new Date(exp.request_date).toLocaleDateString("th-TH")}
                  </td>
                  <td className="px-4 py-3 text-right font-medium text-slate-800">
                    {formatCurrency(exp.total_amount)}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <ExpenseStatusBadge status={exp.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function FilterChip({
  label,
  href,
  active,
}: {
  label: string;
  href: string;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
        active
          ? "bg-blue-600 text-white"
          : "border border-slate-200 bg-white text-slate-600 hover:border-blue-300"
      }`}
    >
      {label}
    </Link>
  );
}
