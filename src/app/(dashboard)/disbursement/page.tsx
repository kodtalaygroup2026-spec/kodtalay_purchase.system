export const dynamic = "force-dynamic";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { type DisbursementPR } from "@/components/disbursement/DisbursementItem";
import { DisbursementBoard } from "@/components/disbursement/DisbursementBoard";
import { ClipboardCheck, ClipboardList } from "lucide-react";

export default async function DisbursementPage() {
  const supabase = await createClient();

  // ── Role guard: เฉพาะ finance และ admin เท่านั้น ─────────────────────────
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
        <p className="mt-1 text-sm text-slate-400">เฉพาะฝ่ายบัญชี/การเงินและผู้ดูแลระบบเท่านั้น</p>
      </div>
    );
  }

  // ── หลักฐานที่รอตรวจสอบ (status = submitted) ────────────────────────────────
  const { data: evidences } = await (supabase as any)
    .from("payment_evidences")
    .select("id, pr_id, account_holder_name, bank_name, bank_account_number, notes, submitted_at")
    .eq("status", "submitted")
    .order("submitted_at", { ascending: false });

  if (!evidences || evidences.length === 0) {
    return <EmptyPage />;
  }

  // Batch fetch PRs (ต้องเป็น pending_finance)
  const prIds = [...new Set((evidences as any[]).map((e: any) => e.pr_id as string))];
  const { data: prs } = await (supabase as any)
    .from("purchase_requisitions")
    .select(`id, pr_number, title, status, total_amount, actual_amount, is_urgent, created_at, requester_id, branches!branch_id(code, name), profiles!requester_id(full_name, line_user_id)`)
    .in("id", prIds)
    .eq("status", "pending_finance");

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

  const allItems: DisbursementPR[] = (evidences as any[])
    .map((evidence: any) => {
      const pr = prMap.get(evidence.pr_id);
      if (!pr) return null; // ข้าม PR ที่ไม่ได้ pending_finance แล้ว
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
        branch_code: pr.branches?.code ?? null,
        branch_name: pr.branches?.name ?? null,
        requester: pr.profiles ? { full_name: pr.profiles.full_name } : null,
        requester_line_id: pr.profiles?.line_user_id ?? null,
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

  if (allItems.length === 0) return <EmptyPage />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <ClipboardCheck size={20} className="text-blue-600" />
            <h1 className="text-xl font-bold text-slate-800">งานตรวจสอบหลักฐาน</h1>
          </div>
          <p className="mt-0.5 text-sm text-slate-500">
            ตรวจบิล/หลักฐานก่อนส่งเข้ารอตั้งจ่าย · รอตรวจ {allItems.length} รายการ
          </p>
        </div>
        <span className="flex h-8 min-w-8 items-center justify-center rounded-full bg-blue-100 px-2.5 text-sm font-bold text-blue-700">
          {allItems.length}
        </span>
      </div>

      <DisbursementBoard items={allItems} currentUserId={user.id} />
    </div>
  );
}

function EmptyPage() {
  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <ClipboardCheck size={20} className="text-blue-600" />
        <h1 className="text-xl font-bold text-slate-800">งานตรวจสอบหลักฐาน</h1>
      </div>
      <div className="rounded-xl border border-dashed border-slate-300 bg-white py-16 text-center">
        <ClipboardList size={32} className="mx-auto mb-3 text-slate-300" />
        <p className="font-medium text-slate-500">ไม่มีหลักฐานที่รอตรวจสอบ</p>
        <p className="mt-1 text-sm text-slate-400">รายการจะปรากฏเมื่อพนักงานแนบหลักฐานส่งเข้ามา</p>
      </div>
    </div>
  );
}
