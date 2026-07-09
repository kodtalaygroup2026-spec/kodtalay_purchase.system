export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PiggyBank } from "lucide-react";
import {
  FinancePaymentConsole,
  type PaymentRow,
  type PaymentCompany,
} from "@/components/finance/FinancePaymentConsole";

export default async function PettyCashPage() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
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
        <p className="mt-1 text-sm text-slate-400">เฉพาะฝ่ายการเงินและผู้ดูแลระบบเท่านั้น</p>
      </div>
    );
  }

  const { data: branchRows } = await (supabase as any)
    .from("branches").select("id, code, name").order("code");
  const branchById: Record<string, { code: string; name: string }> = Object.fromEntries(
    (branchRows ?? []).map((b: any) => [b.id, { code: b.code, name: b.name }])
  );

  // PR ที่รอจ่าย
  const { data: rawPRs } = await (supabase as any)
    .from("purchase_requisitions")
    .select("id, pr_number, title, total_amount, actual_amount, branch_id, requester_id")
    .eq("status", "pending_finance")
    .order("created_at", { ascending: false });
  const prList = (rawPRs ?? []) as any[];
  const prIds = prList.map((p) => p.id);
  const requesterIds = [...new Set(prList.map((p) => p.requester_id))];

  const { data: profileRows } =
    requesterIds.length > 0
      ? await (supabase as any).from("profiles").select("id, full_name, line_user_id").in("id", requesterIds)
      : { data: [] };
  const profileMap: Record<string, { full_name: string; line_user_id: string | null }> =
    Object.fromEntries((profileRows ?? []).map((p: any) => [p.id, p]));

  // evidence verified + ช่องทาง = เงินสดย่อย
  const { data: evidenceRows } =
    prIds.length > 0
      ? await (supabase as any)
          .from("payment_evidences")
          .select("id, pr_id, account_holder_name, bank_name, bank_account_number, ktb_branch_code, status, payment_type, payment_channel, submitted_at")
          .in("pr_id", prIds)
          .eq("status", "verified")
          .eq("payment_channel", "petty_cash")
          .order("submitted_at", { ascending: false })
      : { data: [] };
  const evidenceMap: Record<string, any> = {};
  for (const ev of evidenceRows ?? []) {
    if (!evidenceMap[ev.pr_id]) evidenceMap[ev.pr_id] = ev;
  }

  const payments: PaymentRow[] = prList
    .filter((pr) => evidenceMap[pr.id])
    .map((pr) => {
      const branch = pr.branch_id ? branchById[pr.branch_id] : null;
      const ev = evidenceMap[pr.id] ?? null;
      const requester = profileMap[pr.requester_id] ?? null;
      return {
        id: pr.id,
        pr_number: pr.pr_number,
        title: pr.title,
        amount: pr.actual_amount ?? pr.total_amount ?? 0,
        branch_id: pr.branch_id ?? null,
        branch_code: branch?.code ?? "—",
        branch_name: branch?.name ?? "ไม่ระบุบริษัท",
        requester_name: requester?.full_name ?? "—",
        requester_line_id: requester?.line_user_id ?? null,
        evidence_id: ev?.id ?? null,
        account_holder_name: ev?.account_holder_name ?? "",
        bank_name: ev?.bank_name ?? "",
        bank_account_number: ev?.bank_account_number ?? "",
        ktb_branch_code: ev?.ktb_branch_code ?? "",
        payment_type: (ev?.payment_type ?? "send_bill") as "self_pay" | "send_bill",
      };
    });

  const companies: PaymentCompany[] = (branchRows ?? []).map((b: any) => {
    const rows = payments.filter((p) => p.branch_id === b.id);
    return {
      id: b.id, code: b.code, name: b.name,
      count: rows.length,
      total: rows.reduce((sum, p) => sum + Number(p.amount), 0),
    };
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100">
          <PiggyBank size={20} className="text-emerald-600" />
        </div>
        <div>
          <h1 className="text-lg font-bold text-slate-900">รายการเงินสดย่อย</h1>
          <p className="text-sm text-slate-500">
            รายการที่ฝ่ายการเงินเลือกช่องทาง &ldquo;เงินสดย่อย&rdquo; · จ่ายแบบชุด / แยกรายการ · ตีกลับ · ยกเลิก
          </p>
        </div>
      </div>

      <FinancePaymentConsole
        companies={companies}
        payments={payments}
        settingsByBranch={{}}
        currentUserId={user.id}
        channel="petty_cash"
      />
    </div>
  );
}
