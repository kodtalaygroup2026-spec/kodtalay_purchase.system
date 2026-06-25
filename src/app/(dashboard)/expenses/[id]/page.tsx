import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getExpenseById, getExpenseItems } from "@/lib/expense/queries";
import { ExpenseStatusBadge } from "@/components/expense/ExpenseStatusBadge";
import { ExpenseActionPanel } from "@/components/expense/ExpenseActionPanel";
import { formatCurrency } from "@/lib/utils/format";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";

interface PageProps {
  params: { id: string };
}

export default async function ExpenseDetailPage({ params }: PageProps) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await (supabase as any)
    .from("profiles")
    .select("role")
    .eq("id", user!.id)
    .single();

  const [expense, items] = await Promise.all([
    getExpenseById(params.id),
    getExpenseItems(params.id),
  ]);

  if (!expense) notFound();

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <Link
          href="/expenses"
          className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700"
        >
          <ChevronLeft size={16} />
          ใบเบิกค่าใช้จ่าย
        </Link>
      </div>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-800">{expense.title}</h1>
          <p className="font-mono text-sm text-slate-500">{expense.request_number}</p>
        </div>
        <ExpenseStatusBadge status={expense.status} />
      </div>

      {/* รายละเอียด */}
      <div className="grid gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:grid-cols-2 lg:grid-cols-4">
        <InfoItem label="สาขา" value={expense.branch?.name ?? "-"} />
        <InfoItem
          label="วันที่เบิก"
          value={new Date(expense.request_date).toLocaleDateString("th-TH", {
            year: "numeric",
            month: "long",
            day: "numeric",
          })}
        />
        <InfoItem
          label="ผู้เบิก"
          value={expense.requester?.full_name || expense.requester?.email || "-"}
        />
        <InfoItem
          label="วันที่จ่าย"
          value={
            expense.payment_date
              ? new Date(expense.payment_date).toLocaleDateString("th-TH", {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })
              : "-"
          }
        />
        {expense.note && (
          <div className="sm:col-span-2 lg:col-span-4">
            <InfoItem label="หมายเหตุ" value={expense.note} />
          </div>
        )}
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        {/* รายการ */}
        <div className="lg:col-span-2">
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-100 bg-slate-50 px-4 py-3">
              <h2 className="text-sm font-semibold text-slate-700">รายการค่าใช้จ่าย</h2>
            </div>
            <table className="min-w-full text-sm">
              <thead className="border-b border-slate-100">
                <tr>
                  <th className="px-4 py-2 text-left font-medium text-slate-500">#</th>
                  <th className="px-4 py-2 text-left font-medium text-slate-500">รายละเอียด</th>
                  <th className="px-4 py-2 text-right font-medium text-slate-500">จำนวนเงิน</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {items.map((item, index) => (
                  <tr key={item.id}>
                    <td className="px-4 py-2.5 text-slate-400">{index + 1}</td>
                    <td className="px-4 py-2.5 text-slate-700">{item.description}</td>
                    <td className="px-4 py-2.5 text-right font-medium text-slate-800">
                      {formatCurrency(item.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t border-slate-200 bg-slate-50">
                <tr>
                  <td colSpan={2} className="px-4 py-2.5 text-right text-sm font-semibold text-slate-700">
                    ยอดรวม
                  </td>
                  <td className="px-4 py-2.5 text-right text-base font-bold text-slate-900">
                    {formatCurrency(expense.total_amount)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {/* Action Panel */}
        <div>
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="mb-3 text-sm font-semibold text-slate-700">การดำเนินการ</h2>
            <ExpenseActionPanel
              expenseId={expense.id}
              status={expense.status}
              requesterId={expense.requester_id}
              currentUserId={user!.id}
              currentUserRole={profile?.role ?? "requester"}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <p className="mt-0.5 text-sm text-slate-800">{value}</p>
    </div>
  );
}
