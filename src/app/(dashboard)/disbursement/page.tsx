export const dynamic = "force-dynamic";

import { createClient } from "@/lib/supabase/server";
import { DisbursementItem, type DisbursementPR } from "@/components/disbursement/DisbursementItem";
import { Banknote, ClipboardList } from "lucide-react";

export default async function DisbursementPage() {
  const supabase = await createClient();

  // Fetch PRs รอตรวจสอบจากฝ่ายการเงิน (pending_finance)
  const { data: prs } = await (supabase as any)
    .from("purchase_requisitions")
    .select(`
      id,
      pr_number,
      title,
      total_amount,
      actual_amount,
      is_urgent,
      created_at,
      profiles!requester_id(full_name)
    `)
    .eq("status", "pending_finance")
    .order("created_at", { ascending: true });

  // Fetch evidence สำหรับแต่ละ PR
  const prList: DisbursementPR[] = await Promise.all(
    ((prs ?? []) as any[]).map(async (pr) => {
      const { data: evidence } = await (supabase as any)
        .from("payment_evidences")
        .select("id, account_holder_name, bank_name, bank_account_number, actual_amount, notes, submitted_at")
        .eq("pr_id", pr.id)
        .maybeSingle();

      let files: DisbursementPR["evidence"] extends { files: infer F } | null ? F : never = [];
      if (evidence) {
        const { data: fileData } = await (supabase as any)
          .from("evidence_files")
          .select("id, file_name, file_url, evidence_type, file_size")
          .eq("evidence_id", evidence.id)
          .order("evidence_type");
        files = fileData ?? [];
      }

      return {
        id: pr.id,
        pr_number: pr.pr_number,
        title: pr.title,
        total_amount: pr.total_amount,
        actual_amount: pr.actual_amount ?? null,
        is_urgent: pr.is_urgent ?? false,
        created_at: pr.created_at,
        requester: pr.profiles ?? null,
        evidence: evidence
          ? { ...evidence, files }
          : null,
      };
    })
  );

  // แยกเร่งด่วนขึ้นก่อน
  const urgentList = prList.filter(p => p.is_urgent);
  const normalList = prList.filter(p => !p.is_urgent);
  const sortedList = [...urgentList, ...normalList];

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Banknote size={20} className="text-teal-600" />
            <h1 className="text-xl font-bold text-slate-800">งานแนบจ่าย</h1>
          </div>
          <p className="mt-0.5 text-sm text-slate-500">
            รายการรอตรวจเอกสารและดำเนินการจ่าย — {sortedList.length} รายการ
          </p>
        </div>
        {sortedList.length > 0 && (
          <span className="flex h-8 min-w-8 items-center justify-center rounded-full bg-teal-100 px-2.5 text-sm font-bold text-teal-700">
            {sortedList.length}
          </span>
        )}
      </div>

      {/* ไม่มีรายการ */}
      {sortedList.length === 0 && (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white py-16 text-center">
          <ClipboardList size={32} className="mx-auto mb-3 text-slate-300" />
          <p className="font-medium text-slate-500">ยังไม่มีรายการรอตรวจสอบ</p>
          <p className="mt-1 text-sm text-slate-400">รายการจะปรากฏเมื่อผู้ขอแนบหลักฐานและส่งมาแล้ว</p>
        </div>
      )}

      {/* รายการแนบจ่าย */}
      <div className="space-y-3">
        {sortedList.map(pr => (
          <DisbursementItem key={pr.id} pr={pr} />
        ))}
      </div>

      {/* คำแนะนำขั้นตอน */}
      {sortedList.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-5">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">ขั้นตอนการดำเนินการ</p>
          <ol className="space-y-1.5 text-sm text-slate-600">
            <li className="flex items-start gap-2">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-200 text-[11px] font-bold text-slate-600">1</span>
              ตรวจสอบเอกสาร — คลิกรายการเพื่อดูบิล สลิป และรูปรับของ
            </li>
            <li className="flex items-start gap-2">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-200 text-[11px] font-bold text-slate-600">2</span>
              ตรวจสอบข้อมูลผู้รับเงิน — ชื่อบัญชี ธนาคาร เลขบัญชี
            </li>
            <li className="flex items-start gap-2">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-200 text-[11px] font-bold text-slate-600">3</span>
              กด <strong className="text-teal-700">อนุมัติจ่าย</strong> เพื่อยืนยัน หรือ <strong className="text-orange-700">ตีกลับ</strong> หากเอกสารไม่ครบ
            </li>
          </ol>
        </div>
      )}
    </div>
  );
}
