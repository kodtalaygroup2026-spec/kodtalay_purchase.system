"use client";

import Link from "next/link";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/utils/format";
import {
  AlertTriangle, CheckCircle2, RotateCcw, PencilLine,
  Building2, Wallet, History,
} from "lucide-react";

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
  /** ประวัติการแก้เอกสารของใบนี้ (เก่า → ใหม่) */
  history: DocHistoryEntry[];
}

interface Props {
  docs: IncompleteDoc[];
}

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

export function IncompleteDocsList({ docs }: Props) {
  if (docs.length === 0) {
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
      {docs.map((doc) => {
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
                  <Link
                    href={`/requisitions/incomplete/${doc.id}`}
                    className="ml-auto flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-blue-700"
                  >
                    <PencilLine size={13} /> แก้ไขเอกสาร
                  </Link>
                </>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
