export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AlertTriangle, FileText } from "lucide-react";
import { IncompleteDocsList, type IncompleteDoc } from "@/components/evidence/IncompleteDocsList";
import { MyDocumentsBoard, type MyDocRow, type MyDocState } from "@/components/evidence/MyDocumentsBoard";
import type { PrStatus } from "@/types/database";

export default async function MyDocumentsPage() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // ── ดึงเฉพาะของตัวเองเท่านั้น (ล็อกด้วย requester_id / submitted_by) ────────
  const [{ data: myPRs }, { data: myEvidences }] = await Promise.all([
    (supabase as any)
      .from("purchase_requisitions")
      .select("id, pr_number, title, status, total_amount, actual_amount, created_at, finance_action_at")
      .eq("requester_id", user.id)
      .order("created_at", { ascending: false })
      .limit(300),
    (supabase as any)
      .from("payment_evidences")
      .select("id, pr_id, status, close_status, review_note, payment_channel, submitted_at")
      .eq("submitted_by", user.id)
      .order("submitted_at", { ascending: false }),
  ]);

  const prList = (myPRs ?? []) as any[];

  // หลักฐานฉบับล่าสุดของแต่ละใบ
  const latestEvByPr: Record<string, any> = {};
  for (const ev of myEvidences ?? []) {
    if (!latestEvByPr[ev.pr_id]) latestEvByPr[ev.pr_id] = ev;
  }

  // ── สถานะเอกสารของแต่ละใบ ───────────────────────────────────────────────────
  // incomplete_fix   = ถูกตีกลับ รอแก้ไขแล้วส่งใหม่
  // incomplete_docs  = จ่ายแล้วแต่ค้างเอกสารตัวจริง
  // complete         = จ่ายแล้ว เอกสารครบ
  // in_progress      = ยังอยู่ระหว่างขั้นตอน (ร่าง/รออนุมัติ/รอจ่าย ฯลฯ)
  function docStateOf(pr: any): MyDocState {
    const ev = latestEvByPr[pr.id] ?? null;
    if (pr.status === "paid") {
      if (ev?.close_status === "incomplete") return "incomplete_docs";
      if (ev?.close_status === "fixed") return "fix_review"; // ส่งแก้แล้ว รอ บช. ตรวจ
      return "complete";
    }
    if (
      ev?.status === "returned" &&
      ev?.close_status === "incomplete" &&
      ["approved", "converted"].includes(pr.status)
    ) {
      return "incomplete_fix";
    }
    return "in_progress";
  }

  const docStates: Record<string, MyDocState> = {};
  for (const pr of prList) docStates[pr.id] = docStateOf(pr);

  // ── รายการที่ต้องจัดการ (ส่งให้ IncompleteDocsList เดิม) ────────────────────
  const incompleteDocs: IncompleteDoc[] = prList
    .filter((pr) => docStates[pr.id] === "incomplete_fix" || docStates[pr.id] === "incomplete_docs")
    .map((pr) => {
      const ev = latestEvByPr[pr.id];
      return {
        id: pr.id,
        pr_number: pr.pr_number,
        title: pr.title,
        amount: pr.actual_amount ?? pr.total_amount ?? 0,
        evidence_id: ev.id,
        paid_at: pr.finance_action_at ?? null,
        review_note: ev?.review_note ?? null,
        kind: docStates[pr.id] === "incomplete_fix" ? "returned" : "awaiting_docs",
        payment_channel: (ev?.payment_channel ?? null) as "company" | "petty_cash" | null,
      };
    });

  // ── แถวสำหรับตารางประวัติ (กรอง/ค้นหา/เรียงในฝั่ง client) ───────────────────
  const rows: MyDocRow[] = prList.map((pr) => ({
    id: pr.id,
    pr_number: pr.pr_number,
    title: pr.title,
    created_at: pr.created_at,
    status: pr.status as PrStatus,
    doc_state: docStates[pr.id],
    amount: pr.actual_amount ?? pr.total_amount ?? 0,
  }));

  return (
    <div className="space-y-6">
      {/* ── หัวเรื่อง ─────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100">
          <FileText size={20} className="text-blue-600" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-slate-800">งานเอกสารของฉัน</h1>
          <p className="text-sm text-slate-500">
            สรุปและประวัติใบสั่งซื้อที่คุณสร้างทั้งหมด — จัดการเอกสารที่ไม่สมบูรณ์ได้จากหน้านี้
          </p>
        </div>
      </div>

      {/* การ์ดสรุป (กดกรองได้) + ค้นหา/เรียง + ตารางประวัติ */}
      <MyDocumentsBoard rows={rows}>
        {incompleteDocs.length > 0 && (
          <div className="space-y-3">
            <h2 className="flex items-center gap-2 text-sm font-bold text-slate-700">
              <AlertTriangle size={15} className="text-amber-500" />
              ต้องจัดการ ({incompleteDocs.length})
            </h2>
            <IncompleteDocsList docs={incompleteDocs} currentUserId={user.id} />
          </div>
        )}
      </MyDocumentsBoard>
    </div>
  );
}
