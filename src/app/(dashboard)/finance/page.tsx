export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { formatCurrency } from "@/lib/utils/format";
import { Banknote } from "lucide-react";
import {
  FinanceOverviewBoard,
  type FinancePR,
  type FinanceCompany,
} from "@/components/finance/FinanceOverviewBoard";

export default async function FinancePage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  const isFinance = profile?.role === "finance" || profile?.role === "admin";

  if (!isFinance) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white py-16 text-center">
        <p className="text-slate-500">คุณไม่มีสิทธิ์เข้าถึงหน้านี้</p>
        <p className="mt-1 text-sm text-slate-400">
          เฉพาะฝ่ายการเงินและผู้ดูแลระบบเท่านั้น
        </p>
      </div>
    );
  }

  // ── ดึงบริษัท (สาขา) ทั้งหมด ────────────────────────────────────────────────
  const { data: branchRows } = await (supabase as any)
    .from("branches")
    .select("id, code, name")
    .order("code");

  // ── ดึง PR ที่ส่งมาการเงินแล้ว (pending_finance) ────────────────────────────
  const { data: rawPRs } = await (supabase as any)
    .from("purchase_requisitions")
    .select(
      `id, pr_number, title, total_amount, actual_amount, branch_id,
       profiles!requester_id(full_name)`
    )
    .eq("status", "pending_finance")
    .order("created_at", { ascending: false });

  // map branch_id → { code, name }
  const branchById: Record<string, { code: string; name: string }> = Object.fromEntries(
    (branchRows ?? []).map((b: any) => [b.id, { code: b.code, name: b.name }])
  );

  // ── รายการ PR ทั้งหมด (สำหรับตาราง) ─────────────────────────────────────────
  const prs: FinancePR[] = (rawPRs ?? []).map((pr: any) => {
    const branch = pr.branch_id ? branchById[pr.branch_id] : null;
    return {
      id: pr.id,
      pr_number: pr.pr_number,
      title: pr.title,
      amount: pr.actual_amount ?? pr.total_amount ?? 0,
      requester_name: pr.profiles?.full_name ?? "—",
      branch_code: branch?.code ?? "—",
      branch_name: branch?.name ?? "ไม่ระบุบริษัท",
    };
  });

  // ── สรุปต่อบริษัท (สำหรับการ์ด) ──────────────────────────────────────────────
  const companies: FinanceCompany[] = (branchRows ?? []).map((b: any) => {
    const companyPRs = prs.filter((pr) => pr.branch_code === b.code);
    return {
      code: b.code,
      name: b.name,
      count: companyPRs.length,
      total: companyPRs.reduce((sum, pr) => sum + Number(pr.amount), 0),
    };
  });

  const grandTotal = companies.reduce((sum, c) => sum + c.total, 0);
  const grandCount = companies.reduce((sum, c) => sum + c.count, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100">
            <Banknote size={20} className="text-slate-600" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-900">การเงิน</h1>
            <p className="text-sm text-slate-500">
              รายการที่ส่งมายังการเงิน แยกตามบริษัท
            </p>
          </div>
        </div>
        {grandCount > 0 && (
          <div className="hidden text-right sm:block">
            <p className="text-lg font-bold text-slate-800">{formatCurrency(grandTotal)}</p>
            <p className="text-xs text-slate-400">{grandCount} รายการรอโอนทั้งหมด</p>
          </div>
        )}
      </div>

      {companies.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white py-16 text-center">
          <p className="text-slate-500">ยังไม่มีข้อมูลบริษัท</p>
        </div>
      ) : (
        <FinanceOverviewBoard companies={companies} prs={prs} />
      )}
    </div>
  );
}
