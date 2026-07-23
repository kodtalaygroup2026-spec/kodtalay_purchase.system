export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { EvidenceFixForm } from "@/components/evidence/EvidenceFixForm";
import type { PreviousFile } from "@/components/evidence/EvidenceSubmissionSection";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function FixEvidencePage({ params }: PageProps) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // ── ต้องเป็นเจ้าของใบเท่านั้น (กันเปิดใบคนอื่นด้วยการเดา URL) ────────────────
  const { data: pr } = await (supabase as any)
    .from("purchase_requisitions")
    .select("id, pr_number, title, status, total_amount, actual_amount, finance_action_at, requester_id")
    .eq("id", id)
    .eq("requester_id", user.id)
    .single();

  if (!pr) redirect("/requisitions/incomplete");

  // ── หลักฐานฉบับล่าสุดของใบนี้ ────────────────────────────────────────────────
  const { data: evidenceRows } = await (supabase as any)
    .from("payment_evidences")
    .select("id, close_status, review_note, submitted_at")
    .eq("pr_id", pr.id)
    .order("submitted_at", { ascending: false })
    .limit(1);

  const evidence = (evidenceRows ?? [])[0] ?? null;

  // แก้ได้เฉพาะใบที่ "จ่ายแล้วแต่เอกสารไม่ครบ" เท่านั้น — สถานะอื่นเด้งกลับ
  if (!evidence || pr.status !== "paid" || evidence.close_status !== "incomplete") {
    redirect("/requisitions/incomplete");
  }

  // ── ไฟล์เดิม — เฉพาะที่พนักงานแนบเอง ไม่รวมสลิปจ่ายเงินที่ฝ่ายบัญชีแนบ ────────
  const { data: fileRows } = await (supabase as any)
    .from("evidence_files")
    .select("id, file_name, file_url, evidence_type, file_size")
    .eq("evidence_id", evidence.id)
    .in("evidence_type", ["bill", "slip", "goods_receipt"])
    .order("created_at");

  const previousFiles: PreviousFile[] = ((fileRows ?? []) as any[]).map((f) => ({
    id: f.id,
    file_name: f.file_name,
    file_url: f.file_url,
    evidence_type: f.evidence_type,
    file_size: f.file_size ?? null,
  }));

  return (
    <EvidenceFixForm
      pr={{
        id: pr.id,
        pr_number: pr.pr_number,
        title: pr.title,
        amount: pr.actual_amount ?? pr.total_amount ?? 0,
        paid_at: pr.finance_action_at ?? null,
      }}
      evidenceId={evidence.id}
      reviewNote={evidence.review_note ?? null}
      previousFiles={previousFiles}
      currentUserId={user.id}
    />
  );
}
