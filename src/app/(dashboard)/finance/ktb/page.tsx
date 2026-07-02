export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  KTBTransferForm,
  type PRWithEvidence,
} from "@/components/finance/KTBTransferForm";
import { Landmark } from "lucide-react";

export default async function KTBTransferPage() {
  const supabase = await createClient();

  // ── Role guard ─────────────────────────────────────────────────────────────
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  const isFinance =
    profile?.role === "finance" || profile?.role === "admin";

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

  // ── Fetch company KTB settings ─────────────────────────────────────────────
  const { data: settings } = await (supabase as any)
    .from("company_ktb_settings")
    .select("*")
    .limit(1)
    .maybeSingle();

  // ── Fetch PRs with status = pending_finance ────────────────────────────────
  const { data: rawPRs } = await (supabase as any)
    .from("purchase_requisitions")
    .select(
      "id, pr_number, title, total_amount, actual_amount, ktb_batch_ref, requester_id"
    )
    .eq("status", "pending_finance")
    .order("created_at", { ascending: false });

  const prList = (rawPRs ?? []) as any[];
  const prIds = prList.map((p: any) => p.id);
  const requesterIds = [...new Set(prList.map((p: any) => p.requester_id))];

  // Fetch requester names
  const { data: profileRows } =
    requesterIds.length > 0
      ? await supabase
          .from("profiles")
          .select("id, full_name")
          .in("id", requesterIds)
      : { data: [] };

  const profileMap = Object.fromEntries(
    (profileRows ?? []).map((p) => [p.id, p.full_name])
  );

  // Fetch payment evidences for these PRs
  const { data: evidenceRows } =
    prIds.length > 0
      ? await (supabase as any)
          .from("payment_evidences")
          .select(
            "id, pr_id, account_holder_name, bank_name, bank_account_number, ktb_branch_code, actual_amount"
          )
          .in("pr_id", prIds)
          .order("created_at", { ascending: false })
      : { data: [] };

  // หยิบ evidence ล่าสุดของแต่ละ PR (1 PR → 1 evidence)
  const evidenceMap: Record<string, any> = {};
  for (const ev of evidenceRows ?? []) {
    if (!evidenceMap[ev.pr_id]) evidenceMap[ev.pr_id] = ev;
  }

  // ── Assemble PRWithEvidence list ───────────────────────────────────────────
  const pendingPRs: PRWithEvidence[] = prList.map((pr: any) => {
    const ev = evidenceMap[pr.id] ?? null;
    return {
      id: pr.id,
      pr_number: pr.pr_number,
      title: pr.title,
      total_amount: pr.total_amount ?? 0,
      actual_amount: pr.actual_amount ?? null,
      ktb_batch_ref: pr.ktb_batch_ref ?? null,
      requester_name: profileMap[pr.requester_id] ?? "",
      evidence_id: ev?.id ?? null,
      evidence_account_holder: ev?.account_holder_name ?? "",
      evidence_account_number: ev?.bank_account_number ?? "",
      evidence_bank_name: ev?.bank_name ?? "",
      evidence_amount: ev?.actual_amount ?? null,
      evidence_ktb_branch: ev?.ktb_branch_code ?? "",
    };
  });

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Page header */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100">
          <Landmark size={20} className="text-blue-600" />
        </div>
        <div>
          <h1 className="text-lg font-bold text-slate-900">KTB Smart Transfer</h1>
          <p className="text-sm text-slate-500">
            สร้างไฟล์โอนเงิน 3RD Party สำหรับ KTB Smart Business
          </p>
        </div>
      </div>

      <KTBTransferForm initialSettings={settings} pendingPRs={pendingPRs} />
    </div>
  );
}
