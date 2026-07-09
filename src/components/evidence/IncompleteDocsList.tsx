"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { formatCurrency, formatDate } from "@/lib/utils/format";
import { AlertTriangle, Paperclip, FileText, CheckCircle2, Loader2, X } from "lucide-react";
import { logAudit } from "@/lib/supabase/audit";

export interface IncompleteDoc {
  id: string;          // pr id
  pr_number: string;
  title: string;
  amount: number;
  evidence_id: string;
  paid_at: string | null;
  review_note: string | null;
}

interface Props {
  docs: IncompleteDoc[];
  currentUserId: string;
}

export function IncompleteDocsList({ docs, currentUserId }: Props) {
  const supabase = createClient();
  const [rows, setRows] = useState<IncompleteDoc[]>(docs);
  const [files, setFiles] = useState<Record<string, File | null>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [errorId, setErrorId] = useState<string | null>(null);

  async function confirmComplete(doc: IncompleteDoc) {
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

      // ยืนยันเอกสารครบ → close_status = complete
      const { data, error } = await (supabase as any)
        .from("payment_evidences")
        .update({ close_status: "complete" })
        .eq("id", doc.evidence_id)
        .eq("close_status", "incomplete")
        .select("id");
      if (error) throw error;
      if (!data || data.length === 0) throw new Error("รายการถูกดำเนินการไปแล้ว");

      logAudit({
        actorId: currentUserId,
        action: "documents_completed",
        entity: "purchase_requisitions",
        entityId: doc.id,
        metadata: { pr_id: doc.id, pr_number: doc.pr_number, close_status: "complete" },
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
        return (
          <div key={doc.evidence_id} className="rounded-xl border border-amber-200 bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <Link href={`/requisitions/${doc.id}`} className="font-mono text-xs font-bold text-blue-600 hover:underline">
                    {doc.pr_number}
                  </Link>
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-700">
                    <AlertTriangle size={10} /> ค้างเอกสาร
                  </span>
                </div>
                <p className="mt-0.5 font-semibold text-slate-800">{doc.title}</p>
                <p className="text-xs text-slate-400">
                  จ่ายเมื่อ {doc.paid_at ? formatDate(doc.paid_at) : "—"} · {formatCurrency(doc.amount)}
                </p>
                {doc.review_note && (
                  <p className="mt-1 text-xs text-amber-600">หมายเหตุ: {doc.review_note}</p>
                )}
              </div>
            </div>

            {/* แนบเอกสาร + ยืนยันครบ */}
            <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
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
                onClick={() => confirmComplete(doc)}
                disabled={busy}
                className="ml-auto flex items-center gap-1.5 rounded-lg bg-green-600 px-4 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-green-700 disabled:opacity-60"
              >
                {busy ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle2 size={13} />}
                ยืนยันเอกสารครบ
              </button>
              {errorId === doc.evidence_id && (
                <span className="text-xs text-red-500">เกิดข้อผิดพลาด ลองใหม่</span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
