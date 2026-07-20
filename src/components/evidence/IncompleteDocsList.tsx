"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { formatCurrency, formatDate } from "@/lib/utils/format";
import { AlertTriangle, Paperclip, FileText, CheckCircle2, Loader2, X, RotateCcw, PencilLine, Building2, Wallet } from "lucide-react";
import { logAudit } from "@/lib/supabase/audit";

export interface IncompleteDoc {
  id: string;          // pr id
  pr_number: string;
  title: string;
  amount: number;
  evidence_id: string;
  paid_at: string | null;
  review_note: string | null;
  /** returned = การเงินตีกลับ ยังไม่จ่าย · awaiting_docs = จ่ายแล้วแต่ค้างเอกสารตัวจริง */
  kind: "returned" | "awaiting_docs";
  /** ช่องทางจ่ายที่การเงินเลือก (null = ยังไม่ได้เลือก) */
  payment_channel: "company" | "petty_cash" | null;
}

interface Props {
  docs: IncompleteDoc[];
  currentUserId: string;
}

export function IncompleteDocsList({ docs, currentUserId }: Props) {
  const supabase = createClient();
  const [rows, setRows] = useState<IncompleteDoc[]>(docs);
  const [files, setFiles] = useState<Record<string, File | null>>({});
  const [fixNotes, setFixNotes] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [errorId, setErrorId] = useState<string | null>(null);

  // ส่งเอกสารที่แก้แล้วให้ บช. ตรวจ (ไม่ปิดงานเอง — บช. เป็นคนยืนยันสมบูรณ์)
  async function submitFix(doc: IncompleteDoc) {
    setBusyId(doc.evidence_id);
    setErrorId(null);
    try {
      const file = files[doc.evidence_id];
      // แนบเอกสารเพิ่ม (ถ้ามี)
      if (file) {
        const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
        const path = `${doc.evidence_id}/complete_${Date.now()}_${safeName}`;
        const { error: upErr } = await supabase.storage
          .from("evidence-attachments")
          .upload(path, file, { upsert: false });
        if (upErr) throw new Error(upErr.message);
        const { data: { publicUrl } } = supabase.storage.from("evidence-attachments").getPublicUrl(path);
        await (supabase as any).from("evidence_files").insert({
          evidence_id: doc.evidence_id,
          file_name: file.name,
          file_url: publicUrl,
          evidence_type: "bill",
          file_size: file.size,
          uploaded_by: currentUserId,
        });
      }

      const fixNote = (fixNotes[doc.evidence_id] ?? "").trim();

      // ส่งเข้าคิวตรวจของ บช. → close_status = fixed
      const { data, error } = await (supabase as any)
        .from("payment_evidences")
        .update({
          close_status: "fixed",
          fix_note: fixNote || null,
          fixed_at: new Date().toISOString(),
        })
        .eq("id", doc.evidence_id)
        .eq("close_status", "incomplete")
        .select("id");
      if (error) throw error;
      if (!data || data.length === 0) throw new Error("รายการถูกดำเนินการไปแล้ว");

      logAudit({
        actorId: currentUserId,
        action: "documents_fixed",
        entity: "purchase_requisitions",
        entityId: doc.id,
        metadata: {
          pr_id: doc.id,
          pr_number: doc.pr_number,
          ...(fixNote ? { note: fixNote } : {}),
          ...(file ? { added_file: file.name } : {}),
        },
      });

      setRows((prev) => prev.filter((r) => r.evidence_id !== doc.evidence_id));
    } catch {
      setErrorId(doc.evidence_id);
    } finally {
      setBusyId(null);
    }
  }

  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 bg-white py-16 text-center">
        <CheckCircle2 size={36} className="mx-auto mb-3 text-green-400" />
        <p className="font-medium text-slate-500">ไม่มีเอกสารที่ค้าง</p>
        <p className="mt-1 text-xs text-slate-400">เอกสารของคุณครบสมบูรณ์ทั้งหมด</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {rows.map((doc) => {
        const file = files[doc.evidence_id] ?? null;
        const busy = busyId === doc.evidence_id;
        const isReturned = doc.kind === "returned";
        return (
          <div key={doc.evidence_id} className="rounded-xl border border-amber-200 bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <Link href={`/requisitions/${doc.id}`} className="font-mono text-xs font-bold text-blue-600 hover:underline">
                    {doc.pr_number}
                  </Link>
                  {isReturned ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-orange-100 px-2 py-0.5 text-[11px] font-semibold text-orange-700">
                      <RotateCcw size={10} /> ถูกตีกลับ
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-700">
                      <AlertTriangle size={10} /> ค้างเอกสาร
                    </span>
                  )}
                  {/* แท็กช่องทางจ่ายที่การเงินเลือกไว้ */}
                  {doc.payment_channel === "company" && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2 py-0.5 text-[11px] font-semibold text-blue-700">
                      <Building2 size={10} /> บริษัทสั่งจ่าย
                    </span>
                  )}
                  {doc.payment_channel === "petty_cash" && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
                      <Wallet size={10} /> เงินสดย่อย
                    </span>
                  )}
                </div>
                <p className="mt-0.5 font-semibold text-slate-800">{doc.title}</p>
                <p className="text-xs text-slate-400">
                  {isReturned
                    ? formatCurrency(doc.amount)
                    : `จ่ายเมื่อ ${doc.paid_at ? formatDate(doc.paid_at) : "—"} · ${formatCurrency(doc.amount)}`}
                </p>
                {doc.review_note && (
                  <p className="mt-1 text-xs text-amber-600">
                    {isReturned ? "เหตุผลตีกลับ" : "หมายเหตุ"}: {doc.review_note}
                  </p>
                )}
              </div>
            </div>

            {isReturned ? (
              /* ตีกลับ — ยังไม่จ่าย ต้องกลับไปแก้หลักฐานแล้วส่งมาจ่ายใหม่ */
              <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
                <p className="text-xs text-slate-500">แก้ไขเอกสารในใบสั่งซื้อ แล้วส่งกลับมาให้การเงินจ่ายใหม่อีกครั้ง</p>
                <Link
                  href={`/requisitions/${doc.id}`}
                  className="ml-auto flex items-center gap-1.5 rounded-lg bg-orange-600 px-4 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-orange-700"
                >
                  <PencilLine size={13} /> แก้ไขเอกสาร
                </Link>
              </div>
            ) : (
              /* จ่ายแล้ว แต่ค้างเอกสารตัวจริง — แนบเพิ่ม+อธิบาย แล้วส่งให้ บช. ตรวจ */
              <div className="mt-3 space-y-2 border-t border-slate-100 pt-3">
                <input
                  value={fixNotes[doc.evidence_id] ?? ""}
                  onChange={(e) => setFixNotes((p) => ({ ...p, [doc.evidence_id]: e.target.value }))}
                  placeholder="อธิบายสิ่งที่แก้/เพิ่ม เช่น แนบใบกำกับภาษีตัวจริงแล้ว"
                  className="h-9 w-full rounded-lg border border-slate-300 px-3 text-xs placeholder:text-slate-400 focus:border-blue-500 focus:outline-none"
                />
                <div className="flex flex-wrap items-center gap-2">
                  {file ? (
                    <span className="flex items-center gap-1.5 rounded-lg border border-green-200 bg-green-50 px-2.5 py-1.5 text-xs text-slate-700">
                      <FileText size={13} className="text-green-600" />
                      <span className="max-w-[160px] truncate">{file.name}</span>
                      <button onClick={() => setFiles((p) => ({ ...p, [doc.evidence_id]: null }))} className="text-slate-400 hover:text-red-500">
                        <X size={12} />
                      </button>
                    </span>
                  ) : (
                    <label className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-dashed border-slate-300 bg-slate-50 px-3 py-1.5 text-xs text-slate-500 hover:border-blue-400 hover:bg-blue-50 hover:text-blue-600">
                      <Paperclip size={13} /> แนบใบกำกับ/เอกสาร (ถ้ามี)
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp,application/pdf"
                        onChange={(e) => { const f = e.target.files?.[0]; if (f) setFiles((p) => ({ ...p, [doc.evidence_id]: f })); }}
                        className="hidden"
                      />
                    </label>
                  )}

                  <button
                    onClick={() => submitFix(doc)}
                    disabled={busy}
                    className="ml-auto flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-blue-700 disabled:opacity-60"
                  >
                    {busy ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle2 size={13} />}
                    ส่งให้การเงินตรวจ
                  </button>
                  {errorId === doc.evidence_id && (
                    <span className="text-xs text-red-500">เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง</span>
                  )}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
