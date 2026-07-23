"use client";

import { useState, Fragment } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { formatCurrency, formatDateTime } from "@/lib/utils/format";
import {
  Building2, CheckCircle2, FileText, Loader2, RotateCcw,
  Wallet, Wrench, ChevronDown, X,
} from "lucide-react";
import { logAudit } from "@/lib/supabase/audit";
import { externalBrowserLink } from "@/lib/line/externalLink";
import { useCurrentUserName } from "@/hooks/useCurrentUserName";
import { BranchBadge } from "@/components/shared/BranchBadge";
import { MissingDocsChecklist, buildIncompleteNote } from "./MissingDocsChecklist";

export interface FixedDocRow {
  pr_id: string;
  pr_number: string;
  title: string;
  requester_name: string;
  requester_line_id: string | null;
  branch_code: string | null;
  branch_name: string | null;
  amount: number;
  payment_channel: "company" | "petty_cash" | null;
  evidence_id: string;
  /** เหตุผลที่เคยตีว่าไม่สมบูรณ์ */
  review_note: string | null;
  /** สิ่งที่พนักงานบอกว่าแก้มา */
  fix_note: string | null;
  fixed_at: string | null;
  /** ไฟล์ที่พนักงานแนบเพิ่มหลังจากจ่าย */
  added_files: { name: string; url: string }[];
}

interface Props {
  rows: FixedDocRow[];
  currentUserId: string;
}

const isImage = (nameOrUrl: string) => /\.(png|jpe?g|webp|gif)(\?|$)/i.test(nameOrUrl);

export function FixedDocsReviewList({ rows: initialRows, currentUserId }: Props) {
  const supabase = createClient();
  const router = useRouter();
  const actorName = useCurrentUserName(currentUserId);
  const [rows, setRows] = useState<FixedDocRow[]>(initialRows);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [rejectDocs, setRejectDocs] = useState<string[]>([]);
  const [errorId, setErrorId] = useState<string | null>(null);
  // แถวที่กางดูรายละเอียดอยู่ + รูปที่กดดูเต็มจอ
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  async function sendLine(lineUserId: string, message: string) {
    try {
      await fetch("/api/notifications/line", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lineUserId, message }),
      });
    } catch { /* ไม่ block flow หลัก */ }
  }

  // ── บช. ยืนยัน: เอกสารสมบูรณ์ ปิดงาน ─────────────────────────────────────
  async function approve(row: FixedDocRow) {
    setBusyId(row.evidence_id);
    setErrorId(null);
    try {
      const { data, error } = await (supabase as any)
        .from("payment_evidences")
        .update({
          close_status: "complete",
          reviewed_by: currentUserId,
          reviewed_at: new Date().toISOString(),
        })
        .eq("id", row.evidence_id)
        .eq("close_status", "fixed")
        .select("id");
      if (error) throw error;
      if (!data || data.length === 0) throw new Error("รายการถูกดำเนินการไปแล้ว");

      logAudit({
        actorId: currentUserId,
        action: "documents_completed",
        entity: "purchase_requisitions",
        entityId: row.pr_id,
        metadata: { pr_id: row.pr_id, pr_number: row.pr_number, close_status: "complete" },
      });

      setRows((prev) => prev.filter((r) => r.evidence_id !== row.evidence_id));
      router.refresh();
    } catch {
      setErrorId(row.evidence_id);
    } finally {
      setBusyId(null);
    }
  }

  // ── บช. ตีกลับ: เอกสารยังไม่ครบ ให้แก้อีกรอบ ─────────────────────────────
  async function reject(row: FixedDocRow) {
    if (rejectDocs.length === 0 && !rejectReason.trim()) return;
    setBusyId(row.evidence_id);
    setErrorId(null);
    try {
      const note = buildIncompleteNote(rejectDocs, rejectReason);
      const { data, error } = await (supabase as any)
        .from("payment_evidences")
        .update({
          close_status: "incomplete",
          review_note: note,
          reviewed_by: currentUserId,
          reviewed_at: new Date().toISOString(),
        })
        .eq("id", row.evidence_id)
        .eq("close_status", "fixed")
        .select("id");
      if (error) throw error;
      if (!data || data.length === 0) throw new Error("รายการถูกดำเนินการไปแล้ว");

      logAudit({
        actorId: currentUserId,
        action: "documents_fix_rejected",
        entity: "purchase_requisitions",
        entityId: row.pr_id,
        metadata: { pr_id: row.pr_id, pr_number: row.pr_number, note },
      });

      if (row.requester_line_id) {
        const origin = typeof window !== "undefined" ? window.location.origin : "";
        void sendLine(
          row.requester_line_id,
          `🔄 แจ้งเตือน : เอกสารที่แก้ไขยังไม่สมบูรณ์\n\n` +
          `เลขที่เอกสาร : ${row.pr_number}\nสาขา : ${row.branch_name ?? row.branch_code ?? "—"}\n` +
          `รายการ : ${row.title}\n` +
          `ตรวจโดย : ${actorName || "ฝ่ายการเงิน"}\n` +
          `เอกสารที่ต้องแก้ไข : ${note}\n\n` +
          `กรุณาแก้ไขเพิ่มเติมแล้วส่งให้การเงินตรวจอีกครั้ง\n` +
          `รายละเอียด : ${externalBrowserLink(`${origin}/requisitions/incomplete`)}`
        );
      }

      setRows((prev) => prev.filter((r) => r.evidence_id !== row.evidence_id));
      setRejectingId(null);
      setRejectReason("");
      setRejectDocs([]);
      router.refresh();
    } catch {
      setErrorId(row.evidence_id);
    } finally {
      setBusyId(null);
    }
  }

  if (rows.length === 0) return null;

  return (
    <div className="space-y-3">
      <h2 className="flex items-center gap-2 text-sm font-bold text-slate-700">
        <Wrench size={15} className="text-blue-500" />
        เอกสารแก้ไขแล้ว รอตรวจ ({rows.length})
      </h2>

      <div className="overflow-hidden rounded-xl border border-blue-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="border-b border-slate-100 bg-blue-50/50">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-slate-500">เลขที่ PR</th>
                <th className="px-4 py-3 text-left font-medium text-slate-500">ชื่อรายการ / ผู้ขอ</th>
                <th className="px-4 py-3 text-left font-medium text-slate-500">บริษัท</th>
                <th className="px-4 py-3 text-left font-medium text-slate-500">ช่องทาง</th>
                <th className="px-4 py-3 text-left font-medium text-slate-500 whitespace-nowrap">ส่งแก้เมื่อ</th>
                <th className="px-4 py-3 text-right font-medium text-slate-500 whitespace-nowrap">ยอด</th>
                <th className="w-24 px-3 py-3" />
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const busy = busyId === row.evidence_id;
                const isRejecting = rejectingId === row.evidence_id;
                const isOpen = expandedId === row.evidence_id;
                return (
                  <Fragment key={row.evidence_id}>
                    <tr className={`border-b border-slate-100 transition-colors ${isOpen ? "bg-blue-50/40" : "hover:bg-slate-50"}`}>
                      <td className="px-4 py-3 align-top">
                        <Link
                          href={`/requisitions/${row.pr_id}`}
                          className="font-mono text-xs font-bold text-blue-600 hover:underline"
                        >
                          {row.pr_number}
                        </Link>
                      </td>
                      <td className="max-w-[220px] px-4 py-3 align-top">
                        <p className="truncate font-medium text-slate-800">{row.title}</p>
                        <p className="truncate text-xs text-slate-400">{row.requester_name}</p>
                      </td>
                      <td className="px-4 py-3 align-top">
                        <BranchBadge code={row.branch_code} />
                      </td>
                      <td className="px-4 py-3 align-top">
                        {row.payment_channel === "petty_cash" ? (
                          <span className="inline-flex items-center gap-1 text-xs text-emerald-600">
                            <Wallet size={12} /> เงินสดย่อย
                          </span>
                        ) : row.payment_channel === "company" ? (
                          <span className="inline-flex items-center gap-1 text-xs text-blue-600">
                            <Building2 size={12} /> บริษัท
                          </span>
                        ) : (
                          <span className="text-xs text-slate-300">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 align-top whitespace-nowrap text-xs text-slate-500">
                        {row.fixed_at ? formatDateTime(row.fixed_at) : "—"}
                      </td>
                      <td className="px-4 py-3 align-top text-right font-semibold text-slate-800 whitespace-nowrap">
                        {formatCurrency(row.amount)}
                      </td>
                      <td className="px-3 py-3 text-center align-top">
                        <button
                          onClick={() => setExpandedId(isOpen ? null : row.evidence_id)}
                          className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors ${
                            isOpen
                              ? "border-blue-200 bg-blue-100 text-blue-700"
                              : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50"
                          }`}
                        >
                          ตรวจ
                          <ChevronDown size={12} className={`transition-transform ${isOpen ? "rotate-180" : ""}`} />
                        </button>
                      </td>
                    </tr>

                    {/* ── แถวกางดูรายละเอียด ── */}
                    {isOpen && (
                      <tr className="border-b border-blue-100 bg-blue-50/20">
                        <td colSpan={7} className="px-4 pb-4 pt-1">
                          <div className="grid gap-2 sm:grid-cols-2">
                            <div className="rounded-lg border border-amber-100 bg-amber-50/60 px-3 py-2">
                              <p className="text-[11px] font-semibold text-amber-700">เอกสารที่ให้แก้ (รอบก่อน)</p>
                              <p className="mt-0.5 whitespace-pre-line text-xs text-slate-600">{row.review_note ?? "—"}</p>
                            </div>
                            <div className="rounded-lg border border-blue-100 bg-blue-50/60 px-3 py-2">
                              <p className="text-[11px] font-semibold text-blue-700">พนักงานแจ้งว่าแก้แล้ว</p>
                              <p className="mt-0.5 whitespace-pre-line text-xs text-slate-600">{row.fix_note ?? "—"}</p>
                            </div>
                          </div>

                          {/* ไฟล์ที่แนบเพิ่ม — กดรูปดูเต็มจอในหน้านี้เลย */}
                          {row.added_files.length > 0 && (
                            <div className="mt-3">
                              <p className="mb-1.5 text-[11px] font-semibold text-slate-500">
                                ไฟล์ที่แนบเพิ่ม ({row.added_files.length}) — คลิกเพื่อดูเต็มจอ
                              </p>
                              <div className="flex flex-wrap gap-2">
                                {row.added_files.map((f) => {
                                  const img = isImage(f.name) || isImage(f.url);
                                  return img ? (
                                    <button
                                      key={f.url}
                                      onClick={() => setLightboxUrl(f.url)}
                                      title={f.name}
                                      className="h-20 w-20 overflow-hidden rounded-lg border border-slate-200 bg-slate-50 transition hover:border-blue-400 hover:shadow"
                                    >
                                      {/* eslint-disable-next-line @next/next/no-img-element */}
                                      <img src={f.url} alt={f.name} className="h-full w-full object-cover" />
                                    </button>
                                  ) : (
                                    <a
                                      key={f.url}
                                      href={f.url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      title={f.name}
                                      className="flex h-20 w-20 flex-col items-center justify-center gap-1 rounded-lg border border-slate-200 bg-slate-50 text-red-400 transition hover:border-blue-400 hover:shadow"
                                    >
                                      <FileText size={20} />
                                      <span className="text-[9px] font-semibold text-slate-400">PDF</span>
                                    </a>
                                  );
                                })}
                              </div>
                            </div>
                          )}

                          {/* ── ปุ่มตัดสิน ── */}
                          {isRejecting ? (
                            <div className="mt-3 space-y-2 rounded-lg border border-orange-200 bg-orange-50/60 p-3">
                              <label className="block text-xs font-medium text-orange-800">
                                ระบุเอกสารที่ยังขาด/ไม่ถูกต้อง <span className="text-red-500">*</span>
                              </label>
                              <MissingDocsChecklist selected={rejectDocs} onChange={setRejectDocs} />
                              <textarea
                                value={rejectReason}
                                onChange={(e) => setRejectReason(e.target.value)}
                                rows={2}
                                placeholder="หมายเหตุเพิ่มเติม (ถ้ามี) เช่น ใบกำกับภาษียังไม่ใช่ตัวจริง"
                                className="w-full rounded-lg border border-orange-300 bg-white px-3 py-2 text-sm focus:border-orange-500 focus:outline-none"
                              />
                              <div className="flex items-center justify-end gap-2">
                                <button
                                  onClick={() => { setRejectingId(null); setRejectReason(""); setRejectDocs([]); }}
                                  className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-50"
                                >
                                  ยกเลิก
                                </button>
                                <button
                                  onClick={() => reject(row)}
                                  disabled={busy || (rejectDocs.length === 0 && !rejectReason.trim())}
                                  className="flex items-center gap-1.5 rounded-lg bg-orange-500 px-4 py-1.5 text-xs font-semibold text-white hover:bg-orange-600 disabled:opacity-60"
                                >
                                  {busy ? <Loader2 size={13} className="animate-spin" /> : <RotateCcw size={13} />}
                                  ยืนยันส่งกลับแก้ไข
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="mt-3 flex flex-wrap items-center justify-end gap-2 border-t border-slate-100 pt-3">
                              {errorId === row.evidence_id ? (
                                <span className="mr-auto text-xs text-red-500">เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง</span>
                              ) : (
                                <span className="mr-auto text-[11px] text-slate-400">ยืนยันเมื่อได้รับเอกสารกระดาษตัวจริงครบแล้ว</span>
                              )}
                              <button
                                onClick={() => { setRejectingId(row.evidence_id); setRejectReason(""); setRejectDocs([]); }}
                                disabled={busy}
                                className="flex items-center gap-1.5 rounded-lg border border-orange-300 bg-white px-4 py-1.5 text-xs font-semibold text-orange-600 hover:bg-orange-50 disabled:opacity-60"
                              >
                                <RotateCcw size={13} /> เอกสารไม่สมบูรณ์
                              </button>
                              <button
                                onClick={() => approve(row)}
                                disabled={busy}
                                className="flex items-center gap-1.5 rounded-lg bg-green-600 px-4 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-green-700 disabled:opacity-60"
                              >
                                {busy ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle2 size={13} />}
                                เอกสารสมบูรณ์
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── ดูรูปเต็มจอ ── */}
      {lightboxUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={() => setLightboxUrl(null)}
        >
          <button className="absolute right-4 top-4 rounded-full bg-white/10 p-2 text-white hover:bg-white/20">
            <X size={20} />
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={lightboxUrl}
            alt=""
            className="max-h-full max-w-full rounded-lg object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}
