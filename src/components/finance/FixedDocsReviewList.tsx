"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { formatCurrency, formatDateTime } from "@/lib/utils/format";
import { Building2, CheckCircle2, FileText, Loader2, RotateCcw, Wallet, Wrench } from "lucide-react";
import { logAudit } from "@/lib/supabase/audit";
import { externalBrowserLink } from "@/lib/line/externalLink";
import { useCurrentUserName } from "@/hooks/useCurrentUserName";
import { BranchBadge } from "@/components/shared/BranchBadge";

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

export function FixedDocsReviewList({ rows: initialRows, currentUserId }: Props) {
  const supabase = createClient();
  const router = useRouter();
  const actorName = useCurrentUserName(currentUserId);
  const [rows, setRows] = useState<FixedDocRow[]>(initialRows);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [errorId, setErrorId] = useState<string | null>(null);

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
    if (!rejectReason.trim()) return;
    setBusyId(row.evidence_id);
    setErrorId(null);
    try {
      const note = rejectReason.trim();
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

      {rows.map((row) => {
        const busy = busyId === row.evidence_id;
        const isRejecting = rejectingId === row.evidence_id;
        return (
          <div key={row.evidence_id} className="rounded-xl border border-blue-200 bg-white p-5 shadow-sm">
            {/* หัวการ์ด */}
            <div className="flex flex-wrap items-center gap-2">
              <Link href={`/requisitions/${row.pr_id}`} className="font-mono text-xs font-bold text-blue-600 hover:underline">
                {row.pr_number}
              </Link>
              <BranchBadge code={row.branch_code} />
              {row.payment_channel === "company" && (
                <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2 py-0.5 text-[11px] font-semibold text-blue-700">
                  <Building2 size={10} /> บริษัทสั่งจ่าย
                </span>
              )}
              {row.payment_channel === "petty_cash" && (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
                  <Wallet size={10} /> เงินสดย่อย
                </span>
              )}
              <span className="ml-auto text-sm font-semibold text-slate-700">{formatCurrency(row.amount)}</span>
            </div>
            <p className="mt-1 font-semibold text-slate-800">{row.title}</p>
            <p className="text-xs text-slate-400">
              ผู้ขอ: {row.requester_name}
              {row.fixed_at && <> · ส่งแก้เมื่อ {formatDateTime(row.fixed_at)}</>}
            </p>

            {/* สิ่งที่ตีไว้ vs สิ่งที่แก้มา */}
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <div className="rounded-lg border border-amber-100 bg-amber-50/60 px-3 py-2">
                <p className="text-[11px] font-semibold text-amber-700">เอกสารที่ให้แก้ (รอบก่อน)</p>
                <p className="mt-0.5 text-xs text-slate-600">{row.review_note ?? "—"}</p>
              </div>
              <div className="rounded-lg border border-blue-100 bg-blue-50/60 px-3 py-2">
                <p className="text-[11px] font-semibold text-blue-700">พนักงานแจ้งว่าแก้แล้ว</p>
                <p className="mt-0.5 text-xs text-slate-600">{row.fix_note ?? "—"}</p>
                {row.added_files.length > 0 && (
                  <ul className="mt-1 space-y-0.5">
                    {row.added_files.map((f) => (
                      <li key={f.url}>
                        <a
                          href={f.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-[11px] text-blue-600 hover:underline"
                        >
                          <FileText size={10} /> {f.name}
                        </a>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            {/* ปุ่มตัดสิน */}
            {isRejecting ? (
              <div className="mt-3 space-y-2 rounded-lg border border-orange-200 bg-orange-50/60 p-3">
                <label className="block text-xs font-medium text-orange-800">
                  เอกสารที่ยังต้องแก้ไข <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  rows={2}
                  autoFocus
                  placeholder="เช่น ใบกำกับภาษียังไม่ใช่ตัวจริง / รูปยังไม่ชัด"
                  className="w-full rounded-lg border border-orange-300 bg-white px-3 py-2 text-sm focus:border-orange-500 focus:outline-none"
                />
                <div className="flex items-center justify-end gap-2">
                  <button
                    onClick={() => { setRejectingId(null); setRejectReason(""); }}
                    className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-50"
                  >
                    ยกเลิก
                  </button>
                  <button
                    onClick={() => reject(row)}
                    disabled={busy || !rejectReason.trim()}
                    className="flex items-center gap-1.5 rounded-lg bg-orange-500 px-4 py-1.5 text-xs font-semibold text-white hover:bg-orange-600 disabled:opacity-60"
                  >
                    {busy ? <Loader2 size={13} className="animate-spin" /> : <RotateCcw size={13} />}
                    ยืนยันตีกลับ
                  </button>
                </div>
              </div>
            ) : (
              <div className="mt-3 flex flex-wrap items-center justify-end gap-2 border-t border-slate-100 pt-3">
                {errorId === row.evidence_id && (
                  <span className="mr-auto text-xs text-red-500">เกิดข้อผิดพลาด ลองใหม่</span>
                )}
                <button
                  onClick={() => { setRejectingId(row.evidence_id); setRejectReason(""); }}
                  disabled={busy}
                  className="flex items-center gap-1.5 rounded-lg border border-orange-300 bg-white px-4 py-1.5 text-xs font-semibold text-orange-600 hover:bg-orange-50 disabled:opacity-60"
                >
                  <RotateCcw size={13} /> ตีกลับแก้ไขอีก
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
          </div>
        );
      })}
    </div>
  );
}
