export const dynamic = "force-dynamic";

import { createClient } from "@/lib/supabase/server";
import { DisbursementList } from "@/components/disbursement/DisbursementList";
import { DisbursementItem, type DisbursementPR } from "@/components/disbursement/DisbursementItem";
import { Banknote, ClipboardList, Clock } from "lucide-react";

export default async function DisbursementPage() {
  const supabase = await createClient();

  // Fetch all payment_evidences
  const { data: evidences } = await (supabase as any)
    .from("payment_evidences")
    .select("id, pr_id, account_holder_name, bank_name, bank_account_number, notes, submitted_at")
    .order("submitted_at", { ascending: false });

  if (!evidences || evidences.length === 0) {
    return <EmptyPage />;
  }

  // Batch fetch PRs
  const prIds = [...new Set((evidences as any[]).map((e: any) => e.pr_id as string))];
  const { data: prs } = await (supabase as any)
    .from("purchase_requisitions")
    .select(`id, pr_number, title, status, total_amount, actual_amount, is_urgent, created_at, profiles!requester_id(full_name)`)
    .in("id", prIds);

  const prMap = new Map<string, any>((prs ?? []).map((pr: any) => [pr.id, pr]));

  // Batch fetch evidence_files
  const evidenceIds = (evidences as any[]).map((e: any) => e.id as string);
  const { data: allFiles } = await (supabase as any)
    .from("evidence_files")
    .select("id, evidence_id, file_name, file_url, evidence_type, file_size")
    .in("evidence_id", evidenceIds)
    .order("evidence_type");

  const filesMap = new Map<string, any[]>();
  for (const file of (allFiles ?? []) as any[]) {
    const list = filesMap.get(file.evidence_id) ?? [];
    list.push(file);
    filesMap.set(file.evidence_id, list);
  }

  // Build full list
  const allItems: DisbursementPR[] = (evidences as any[])
    .map((evidence: any) => {
      const pr = prMap.get(evidence.pr_id);
      if (!pr) return null;
      const files = filesMap.get(evidence.id) ?? [];
      return {
        id: pr.id,
        pr_number: pr.pr_number,
        title: pr.title,
        status: pr.status ?? "pending_finance",
        total_amount: pr.total_amount,
        actual_amount: pr.actual_amount ?? null,
        is_urgent: pr.is_urgent ?? false,
        created_at: pr.created_at,
        submitted_at: evidence.submitted_at,
        requester: pr.profiles ?? null,
        evidence: {
          id: evidence.id,
          account_holder_name: evidence.account_holder_name,
          bank_name: evidence.bank_name ?? null,
          bank_account_number: evidence.bank_account_number ?? null,
          actual_amount: null,
          notes: evidence.notes ?? null,
          submitted_at: evidence.submitted_at,
          files: files.map((f: any) => ({
            id: f.id,
            file_name: f.file_name,
            file_url: f.file_url,
            evidence_type: f.evidence_type,
            file_size: f.file_size ?? null,
          })),
        },
      } satisfies DisbursementPR;
    })
    .filter(Boolean) as DisbursementPR[];

  // แยก pending_finance (รอดำเนินการ) ออกจาก history (paid/cancelled)
  const pendingItems = allItems.filter(p => p.status === "pending_finance" || p.status === "approved");
  const historyItems = allItems.filter(p => p.status !== "pending_finance" && p.status !== "approved");

  // urgent ขึ้นก่อน
  const sortedPending = [
    ...pendingItems.filter(p => p.is_urgent),
    ...pendingItems.filter(p => !p.is_urgent),
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Banknote size={20} className="text-teal-600" />
            <h1 className="text-xl font-bold text-slate-800">งานแนบจ่าย</h1>
          </div>
          <p className="mt-0.5 text-sm text-slate-500">
            {pendingItems.length > 0 && `รอดำเนินการ ${pendingItems.length} รายการ`}
            {pendingItems.length > 0 && historyItems.length > 0 && " · "}
            {historyItems.length > 0 && `ประวัติ ${historyItems.length} รายการ`}
          </p>
        </div>
        {pendingItems.length > 0 && (
          <span className="flex h-8 min-w-8 items-center justify-center rounded-full bg-teal-100 px-2.5 text-sm font-bold text-teal-700">
            {pendingItems.length}
          </span>
        )}
      </div>

      {/* ── รอดำเนินการ (pending_finance) ─────────────────────────────── */}
      {sortedPending.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <Clock size={15} className="text-teal-600" />
            <h2 className="text-sm font-semibold text-slate-700">รอดำเนินการ</h2>
            <span className="rounded-full bg-teal-100 px-2 py-0.5 text-[10px] font-bold text-teal-700">
              {sortedPending.length}
            </span>
          </div>
          <div className="space-y-3">
            {sortedPending.map(pr => (
              <DisbursementItem key={pr.id} pr={pr} />
            ))}
          </div>
        </section>
      )}

      {/* ── ประวัติ (paid / cancelled) ─────────────────────────────────── */}
      <section className="space-y-3">
        {historyItems.length > 0 && (
          <div className="flex items-center gap-2">
            <ClipboardList size={15} className="text-slate-500" />
            <h2 className="text-sm font-semibold text-slate-700">ประวัติการจ่าย</h2>
          </div>
        )}
        <DisbursementList items={historyItems} />
      </section>
    </div>
  );
}

function EmptyPage() {
  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <Banknote size={20} className="text-teal-600" />
        <h1 className="text-xl font-bold text-slate-800">งานแนบจ่าย</h1>
      </div>
      <div className="rounded-xl border border-dashed border-slate-300 bg-white py-16 text-center">
        <ClipboardList size={32} className="mx-auto mb-3 text-slate-300" />
        <p className="font-medium text-slate-500">ยังไม่มีรายการที่ส่งหลักฐาน</p>
        <p className="mt-1 text-sm text-slate-400">รายการจะปรากฏเมื่อผู้ขอแนบหลักฐานและส่งมาแล้ว</p>
      </div>
    </div>
  );
}
