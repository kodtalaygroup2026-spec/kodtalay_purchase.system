"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/utils/format";
import {
  AlertTriangle, Paperclip, FileText, CheckCircle2, Loader2, X,
  RotateCcw, PencilLine, Building2, Wallet, History,
} from "lucide-react";
import { logAudit } from "@/lib/supabase/audit";

interface EvidenceFileRow {
  id: string;
  file_name: string;
  file_url: string;
  evidence_type: string;
}

export interface DocHistoryEntry {
  id: string;
  action: string;
  actor: string;
  at: string;
  note: string | null;
  addedFiles: number | null;
  removedFiles: number | null;
  closeStatus: string | null;
}

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
  /** ไฟล์หลักฐานที่เคยส่งไป — ให้ลบ/เพิ่มแก้ไขได้ */
  files: EvidenceFileRow[];
  /** ประวัติการแก้เอกสารของใบนี้ (เก่า → ใหม่) */
  history: DocHistoryEntry[];
}

interface Props {
  docs: IncompleteDoc[];
  currentUserId: string;
}

const isImage = (nameOrUrl: string) => /\.(png|jpe?g|webp|gif)(\?|$)/i.test(nameOrUrl);

// แปลง audit action เป็นข้อความ/สีในไทม์ไลน์ประวัติการแก้ไข
function historyMeta(entry: DocHistoryEntry): { label: string; dot: string; text: string } {
  switch (entry.action) {
    case "payment_marked_paid":
      return entry.closeStatus === "incomplete"
        ? { label: "ฝ่ายบัญชีจ่ายเงินแล้ว — แจ้งว่าเอกสารไม่ครบ", dot: "bg-amber-500", text: "text-amber-700" }
        : { label: "ฝ่ายบัญชีจ่ายเงินแล้ว", dot: "bg-green-500", text: "text-green-700" };
    case "documents_fixed":
      return { label: "ส่งเอกสารที่แก้ให้ฝ่ายบัญชีตรวจ", dot: "bg-blue-500", text: "text-blue-700" };
    case "documents_fix_rejected":
      return { label: "ฝ่ายบัญชีตีกลับ — เอกสารยังไม่ครบ", dot: "bg-orange-500", text: "text-orange-700" };
    case "documents_completed":
      return { label: "ฝ่ายบัญชียืนยันเอกสารสมบูรณ์", dot: "bg-green-500", text: "text-green-700" };
    default:
      return { label: entry.action, dot: "bg-slate-400", text: "text-slate-600" };
  }
}

export function IncompleteDocsList({ docs, currentUserId }: Props) {
  const supabase = createClient();
  const [rows, setRows] = useState<IncompleteDoc[]>(docs);
  // ไฟล์เดิมที่ยังเก็บไว้ / ไฟล์เดิมที่กดลบ / ไฟล์ใหม่ที่จะอัปโหลด — แยกต่อใบ (key = evidence_id)
  const [keptFiles, setKeptFiles] = useState<Record<string, EvidenceFileRow[]>>(
    () => Object.fromEntries(docs.map((d) => [d.evidence_id, d.files]))
  );
  const [removedIds, setRemovedIds] = useState<Record<string, string[]>>({});
  const [newFiles, setNewFiles] = useState<Record<string, File[]>>({});
  const [fixNotes, setFixNotes] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [errorId, setErrorId] = useState<string | null>(null);
  // ใบที่กำลังเปิดโมดัลแก้ไขอยู่ (evidence_id)
  const [editingId, setEditingId] = useState<string | null>(null);

  function removeExisting(evId: string, fileId: string) {
    setKeptFiles((p) => ({ ...p, [evId]: (p[evId] ?? []).filter((f) => f.id !== fileId) }));
    setRemovedIds((p) => ({ ...p, [evId]: [...(p[evId] ?? []), fileId] }));
  }
  function addNewFiles(evId: string, list: FileList | null) {
    const picked = Array.from(list ?? []);
    if (picked.length === 0) return;
    setNewFiles((p) => ({ ...p, [evId]: [...(p[evId] ?? []), ...picked] }));
  }
  function removeNewFile(evId: string, idx: number) {
    setNewFiles((p) => ({ ...p, [evId]: (p[evId] ?? []).filter((_, i) => i !== idx) }));
  }

  // ปิดโมดัลแล้วคืนค่าที่แก้ค้างไว้ (ยังไม่ได้ส่ง) กลับเป็นของเดิม
  function cancelEdit(doc: IncompleteDoc) {
    setKeptFiles((p) => ({ ...p, [doc.evidence_id]: doc.files }));
    setRemovedIds((p) => ({ ...p, [doc.evidence_id]: [] }));
    setNewFiles((p) => ({ ...p, [doc.evidence_id]: [] }));
    setEditingId(null);
  }

  // ส่งเอกสารที่แก้แล้วให้ บช. ตรวจ (ไม่ปิดงานเอง — บช. เป็นคนยืนยันสมบูรณ์)
  async function submitFix(doc: IncompleteDoc) {
    setBusyId(doc.evidence_id);
    setErrorId(null);
    try {
      // 1) อัปโหลดไฟล์ใหม่ทั้งหมด
      const adds = newFiles[doc.evidence_id] ?? [];
      for (const file of adds) {
        const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
        const path = `${doc.evidence_id}/fix_${Date.now()}_${safeName}`;
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

      // 2) ลบไฟล์เดิมที่เอาออก (ลบเฉพาะแถวใน DB — object ใน storage ปล่อยเป็น orphan ได้ ไม่กระทบ)
      const removed = removedIds[doc.evidence_id] ?? [];
      const removedNames = doc.files.filter((f) => removed.includes(f.id)).map((f) => f.file_name);
      if (removed.length > 0) {
        await (supabase as any).from("evidence_files").delete().in("id", removed);
      }

      const fixNote = (fixNotes[doc.evidence_id] ?? "").trim();

      // 3) ส่งเข้าคิวตรวจของ บช. → close_status = fixed
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

      // 4) บันทึกประวัติการแก้ไข (ไปโผล่ในไทม์ไลน์ทั้งฝั่งคนเบิกและ บช.)
      logAudit({
        actorId: currentUserId,
        action: "documents_fixed",
        entity: "purchase_requisitions",
        entityId: doc.id,
        metadata: {
          pr_id: doc.id,
          pr_number: doc.pr_number,
          ...(fixNote ? { note: fixNote } : {}),
          ...(adds.length ? { added_files: adds.length, added_file_names: adds.map((f) => f.name) } : {}),
          ...(removed.length ? { removed_files: removed.length, removed_file_names: removedNames } : {}),
        },
      });

      setEditingId(null);
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

  const editingDoc = rows.find((r) => r.evidence_id === editingId) ?? null;

  return (
    <>
      <div className="space-y-3">
        {rows.map((doc) => {
          const isReturned = doc.kind === "returned";
          return (
            <div key={doc.evidence_id} className="rounded-xl border border-amber-200 bg-white p-5 shadow-sm">
              {/* ── หัวใบ ── */}
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
                    <p className="mt-1 whitespace-pre-line rounded-lg bg-amber-50 px-3 py-1.5 text-xs text-amber-700">
                      {isReturned ? "เหตุผลตีกลับ" : "ฝ่ายบัญชีแจ้งว่าต้องแก้"}: {doc.review_note}
                    </p>
                  )}
                </div>
              </div>

              {/* ── ประวัติการแก้ไข ── */}
              {doc.history.length > 0 && (
                <div className="mt-3 border-t border-slate-100 pt-3">
                  <p className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-slate-500">
                    <History size={13} /> ประวัติการแก้ไข ({doc.history.length})
                  </p>
                  <ol className="space-y-1.5">
                    {doc.history.map((h) => {
                      const meta = historyMeta(h);
                      const counts = [
                        h.addedFiles ? `เพิ่ม ${h.addedFiles} ไฟล์` : null,
                        h.removedFiles ? `ลบ ${h.removedFiles} ไฟล์` : null,
                      ].filter(Boolean).join(" · ");
                      return (
                        <li key={h.id} className="flex gap-2 text-xs">
                          <span className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${meta.dot}`} />
                          <div className="min-w-0">
                            <span className={`font-medium ${meta.text}`}>{meta.label}</span>
                            <span className="text-slate-400"> · {h.actor} · {formatDateTime(h.at)}</span>
                            {counts && <span className="ml-1 text-slate-500">({counts})</span>}
                            {h.note && <p className="mt-0.5 whitespace-pre-line text-slate-500">{h.note}</p>}
                          </div>
                        </li>
                      );
                    })}
                  </ol>
                </div>
              )}

              {/* ── ปุ่มดำเนินการ ── */}
              <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
                {isReturned ? (
                  <>
                    <p className="text-xs text-slate-500">แก้ไขเอกสารในใบสั่งซื้อ แล้วส่งกลับมาให้การเงินจ่ายใหม่อีกครั้ง</p>
                    <Link
                      href={`/requisitions/${doc.id}`}
                      className="ml-auto flex items-center gap-1.5 rounded-lg bg-orange-600 px-4 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-orange-700"
                    >
                      <PencilLine size={13} /> แก้ไขเอกสาร
                    </Link>
                  </>
                ) : (
                  <>
                    <p className="text-xs text-slate-500">
                      แก้ไขไฟล์หลักฐานให้ถูกต้อง แล้วส่งให้ฝ่ายบัญชีตรวจอีกครั้ง
                    </p>
                    {errorId === doc.evidence_id && (
                      <span className="text-xs text-red-500">เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง</span>
                    )}
                    <button
                      onClick={() => setEditingId(doc.evidence_id)}
                      className="ml-auto flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-blue-700"
                    >
                      <PencilLine size={13} /> แก้ไขเอกสาร
                    </button>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* ── โมดัลแก้ไขไฟล์หลักฐาน ── */}
      {editingDoc && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => busyId === null && cancelEdit(editingDoc)}
        >
          <div
            className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex shrink-0 items-center justify-between px-5 pb-3 pt-5">
              <div className="min-w-0">
                <h3 className="font-semibold text-slate-800">แก้ไขเอกสาร</h3>
                <p className="truncate font-mono text-xs text-slate-400">
                  {editingDoc.pr_number} · {editingDoc.title}
                </p>
              </div>
              <button
                onClick={() => busyId === null && cancelEdit(editingDoc)}
                className="rounded p-1 text-slate-400 hover:bg-slate-100"
              >
                <X size={18} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 pb-1">
              {editingDoc.review_note && (
                <p className="mb-3 whitespace-pre-line rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
                  ฝ่ายบัญชีแจ้งว่าต้องแก้: {editingDoc.review_note}
                </p>
              )}

              <p className="mb-1.5 text-xs font-medium text-slate-500">
                ไฟล์หลักฐาน — ลบไฟล์ที่ผิด/ไม่ชัด แล้วแนบไฟล์ใหม่ให้ถูกต้อง
              </p>
              <div className="flex flex-wrap gap-2">
                {(keptFiles[editingDoc.evidence_id] ?? []).map((f) => (
                  <FileThumb
                    key={f.id}
                    name={f.file_name}
                    url={f.file_url}
                    onRemove={() => removeExisting(editingDoc.evidence_id, f.id)}
                  />
                ))}
                {(newFiles[editingDoc.evidence_id] ?? []).map((f, i) => (
                  <FileThumb
                    key={`new-${i}`}
                    name={f.name}
                    url={URL.createObjectURL(f)}
                    isNew
                    onRemove={() => removeNewFile(editingDoc.evidence_id, i)}
                  />
                ))}
                <label className="flex h-16 w-16 shrink-0 cursor-pointer flex-col items-center justify-center gap-0.5 rounded-lg border border-dashed border-slate-300 bg-slate-50 text-[10px] text-slate-400 transition hover:border-blue-400 hover:bg-blue-50 hover:text-blue-600">
                  <Paperclip size={14} /> เพิ่มไฟล์
                  <input
                    type="file"
                    multiple
                    accept="image/jpeg,image/png,image/webp,application/pdf"
                    onChange={(e) => { addNewFiles(editingDoc.evidence_id, e.target.files); e.target.value = ""; }}
                    className="hidden"
                  />
                </label>
              </div>

              <label className="mb-1 mt-4 block text-xs font-medium text-slate-500">
                อธิบายสิ่งที่แก้ (จะบันทึกลงประวัติการแก้ไข)
              </label>
              <textarea
                value={fixNotes[editingDoc.evidence_id] ?? ""}
                onChange={(e) => setFixNotes((p) => ({ ...p, [editingDoc.evidence_id]: e.target.value }))}
                rows={2}
                placeholder="เช่น แนบใบกำกับภาษีตัวจริงแล้ว / เปลี่ยนรูปบิลให้ชัดขึ้น"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm placeholder:text-slate-400 focus:border-blue-500 focus:outline-none"
              />

              {errorId === editingDoc.evidence_id && (
                <p className="mt-2 text-xs text-red-600">เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง</p>
              )}
            </div>

            <div className="flex shrink-0 justify-end gap-2 border-t border-slate-100 px-5 pb-5 pt-4">
              <button
                onClick={() => busyId === null && cancelEdit(editingDoc)}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50"
              >
                ยกเลิก
              </button>
              <button
                onClick={() => submitFix(editingDoc)}
                disabled={busyId === editingDoc.evidence_id}
                className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 disabled:opacity-60"
              >
                {busyId === editingDoc.evidence_id
                  ? <Loader2 size={14} className="animate-spin" />
                  : <CheckCircle2 size={14} />}
                ส่งให้การเงินตรวจ
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// รูปย่อไฟล์หลักฐาน — กดดูได้ + ปุ่มลบมุมขวาบน
function FileThumb({ name, url, isNew, onRemove }: { name: string; url: string; isNew?: boolean; onRemove: () => void }) {
  const img = isImage(name) || isImage(url);
  return (
    <div className="group relative h-16 w-16 shrink-0 overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
      <a href={url} target="_blank" rel="noopener noreferrer" className="block h-full w-full" title={name}>
        {img ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt={name} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center gap-0.5 text-red-400">
            <FileText size={18} />
            <span className="text-[8px] font-semibold text-slate-400">PDF</span>
          </div>
        )}
      </a>
      {isNew && (
        <span className="absolute left-0.5 top-0.5 rounded bg-green-500 px-1 text-[8px] font-bold text-white">ใหม่</span>
      )}
      <button
        onClick={onRemove}
        className="absolute right-0.5 top-0.5 rounded-full bg-white/90 p-0.5 text-slate-400 shadow hover:text-red-500"
      >
        <X size={11} />
      </button>
    </div>
  );
}
