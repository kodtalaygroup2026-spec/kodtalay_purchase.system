export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { formatCurrency } from "@/lib/utils/format";
import { ListFilter } from "lucide-react";
import {
  FinanceOverviewBoard,
  type FinancePR,
  type FinanceCompany,
  type FinanceRowStatus,
} from "@/components/finance/FinanceOverviewBoard";

/** แปลงสถานะ PR + สถานะหลักฐาน เป็นสถานะที่ฝ่ายการเงินเข้าใจ */
function deriveRowStatus(prStatus: string, evidenceStatus: string | null): FinanceRowStatus {
  if (prStatus === "cancelled") return "cancelled";
  if (prStatus === "paid") return "paid";
  if (evidenceStatus === "paid") return "paid";
  if (evidenceStatus === "returned") return "returned";
  if (evidenceStatus === "verified") return "pending_pay";
  return "pending_verify";
}

/** วันที่ล่าสุดที่มีความเคลื่อนไหวของรายการ */
function deriveRowDate(pr: any, ev: any): string | null {
  if (pr.status === "paid") return pr.finance_action_at ?? ev?.reviewed_at ?? ev?.submitted_at ?? null;
  return ev?.reviewed_at ?? ev?.submitted_at ?? pr.created_at ?? null;
}

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

  const branchById: Record<string, { code: string; name: string }> = Object.fromEntries(
    (branchRows ?? []).map((b: any) => [b.id, { code: b.code, name: b.name }])
  );

  // ── KTB settings per branch (สำหรับสร้างไฟล์ KTB) ──────────────────────────
  const { data: settingsRows } = await (supabase as any)
    .from("company_ktb_settings")
    .select("*");
  const settingsByBranch: Record<string, Record<string, string>> = {};
  for (const row of settingsRows ?? []) {
    if (row.branch_id) settingsByBranch[row.branch_id] = row;
  }

  // ── หลักฐานทุกใบที่ส่งมายังการเงิน (เอาเฉพาะฉบับล่าสุดของแต่ละ PR) ──────────
  const { data: evidenceRows } = await (supabase as any)
    .from("payment_evidences")
    .select(
      `pr_id, status, payment_channel, submitted_at, reviewed_at,
       account_holder_name, bank_account_number, ktb_branch_code`
    )
    .order("submitted_at", { ascending: false })
    .limit(1000);

  const latestEvidenceByPR: Record<string, any> = {};
  for (const ev of evidenceRows ?? []) {
    if (!latestEvidenceByPR[ev.pr_id]) latestEvidenceByPR[ev.pr_id] = ev;
  }
  const prIds = Object.keys(latestEvidenceByPR);

  // ── ใบสั่งซื้อของหลักฐานเหล่านั้น (ทุกสถานะ) ────────────────────────────────
  const { data: prRows } =
    prIds.length > 0
      ? await (supabase as any)
          .from("purchase_requisitions")
          .select(
            `id, pr_number, title, status, total_amount, actual_amount, branch_id,
             finance_action_at, created_at, profiles!requester_id(full_name)`
          )
          .in("id", prIds)
      : { data: [] };

  const prs: FinancePR[] = (prRows ?? []).map((pr: any) => {
    const branch = pr.branch_id ? branchById[pr.branch_id] : null;
    const ev = latestEvidenceByPR[pr.id] ?? null;
    return {
      id: pr.id,
      pr_number: pr.pr_number,
      title: pr.title,
      amount: pr.actual_amount ?? pr.total_amount ?? 0,
      requester_name: pr.profiles?.full_name ?? "—",
      branch_code: branch?.code ?? "—",
      branch_name: branch?.name ?? "ไม่ระบุบริษัท",
      status: deriveRowStatus(pr.status, ev?.status ?? null),
      channel: (ev?.payment_channel ?? null) as "company" | "petty_cash" | null,
      date: deriveRowDate(pr, ev),
      paid_at: pr.finance_action_at ?? null,
      account_holder_name: ev?.account_holder_name ?? "",
      bank_account_number: ev?.bank_account_number ?? "",
      ktb_branch_code: ev?.ktb_branch_code ?? "",
    };
  });

  // ── สรุปต่อบริษัท ───────────────────────────────────────────────────────────
  const companies: FinanceCompany[] = (branchRows ?? []).map((b: any) => {
    const rows = prs.filter((pr) => pr.branch_code === b.code);
    const pending = rows.filter((pr) => pr.status === "pending_pay");
    return {
      id: b.id,
      code: b.code,
      name: b.name,
      count: rows.length,
      total: rows.reduce((sum, pr) => sum + Number(pr.amount), 0),
      pendingCount: pending.length,
      pendingTotal: pending.reduce((sum, pr) => sum + Number(pr.amount), 0),
      paidCount: rows.filter((pr) => pr.status === "paid").length,
    };
  });

  const grandTotal = prs.reduce((sum, pr) => sum + Number(pr.amount), 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100">
            <ListFilter size={20} className="text-slate-600" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-900">รายการทั้งหมด</h1>
            <p className="text-sm text-slate-500">
              ทุกใบที่ส่งมายังฝ่ายการเงิน — ทุกสถานะและทุกช่องทาง
            </p>
          </div>
        </div>
        {prs.length > 0 && (
          <div className="hidden text-right sm:block">
            <p className="text-lg font-bold text-slate-800">{formatCurrency(grandTotal)}</p>
            <p className="text-xs text-slate-400">{prs.length} รายการทั้งหมด</p>
          </div>
        )}
      </div>

      {companies.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white py-16 text-center">
          <p className="text-slate-500">ยังไม่มีข้อมูลบริษัท</p>
        </div>
      ) : (
        <FinanceOverviewBoard companies={companies} prs={prs} settingsByBranch={settingsByBranch} />
      )}
    </div>
  );
}
