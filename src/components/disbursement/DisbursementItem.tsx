"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import {
  ChevronDown, ChevronUp, AlertTriangle,
  FileText, ImageIcon, Package, ExternalLink,
  RotateCcw, CheckCircle, Loader2, ZoomIn, X, Wallet, Building2,
} from "lucide-react";
import { formatCurrency, formatDateTime } from "@/lib/utils/format";
import { logAudit } from "@/lib/supabase/audit";
import { externalBrowserLink } from "@/lib/line/externalLink";
import { useCurrentUserName } from "@/hooks/useCurrentUserName";

const BANK_LABELS: Record<string, string> = {
  KBANK: "กสิกรไทย",
  SCB:   "ไทยพาณิชย์",
  BBL:   "กรุงเทพ",
  KTB:   "กรุงไทย",
  TTB:   "ทีทีบี",
  BAY:   "กรุงศรีอยุธยา",
  GSB:   "ออมสิน",
  GHB:   "อาคารสงเคราะห์",
  BAAC:  "ธ.ก.ส.",
  KKP:   "เกียรตินาคิน",
  CIMBT: "ซีไอเอ็มบี",
  UOB:   "ยูโอบี",
  TISCO: "ทิสโก้",
  LHB:   "แลนด์แอนด์เฮ้าส์",
};

const FILE_TYPE_LABELS: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  bill:          { label: "บิล / ใบเสร็จ",  icon: FileText,   color: "text-orange-500" },
  slip:          { label: "สลิปโอนเงิน",   icon: ImageIcon,  color: "text-blue-500" },
  goods_receipt: { label: "รูปรับของ",       icon: Package,    color: "text-green-500" },
  other:         { label: "อื่นๆ",           icon: FileText,   color: "text-slate-400" },
};

export interface DisbursementPR {
  id: string;
  pr_number: string;
  title: string;
  status: string;
  total_amount: number;
  actual_amount: number | null;
  is_urgent: boolean;
  created_at: string;
  submitted_at: string;
  branch_code: string | null;
  branch_name: string | null;
  requester: { full_name: string } | null;
  requester_line_id: string | null;
  evidence: {
    id: string;
    account_holder_name: string;
    bank_name: string | null;
    bank_account_number: string | null;
    actual_amount: number | null;
    notes: string | null;
    submitted_at: string;
    files: {
      id: string;
      file_name: string;
      file_url: string;
      evidence_type: string;
      file_size: number | null;
    }[];
  } | null;
}

interface DisbursementItemProps {
  pr: DisbursementPR;
  currentUserId: string;
}

export function DisbursementItem({ pr, currentUserId }: DisbursementItemProps) {
  const router = useRouter();
  const supabase = createClient();
  const actorName = useCurrentUserName(currentUserId);
  const [isExpanded, setIsExpanded] = useState(false);
  const [loadingAction, setLoadingAction] = useState<"return" | "verify" | null>(null);
  const [confirmAction, setConfirmAction] = useState<"return" | "verify" | null>(null);
  const [verifyChannel, setVerifyChannel] = useState<"company" | "petty_cash">("company");
  const [returnReason, setReturnReason] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  const evidence = pr.evidence;
  const actualAmount = evidence?.actual_amount ?? pr.actual_amount ?? null;
  const budgetDiff = actualAmount && pr.total_amount
    ? ((actualAmount - pr.total_amount) / pr.total_amount) * 100
    : null;
  const isOverBudget = budgetDiff !== null && budgetDiff > 10;

  async function sendLine(lineUserId: string, message: string) {
    try {
      await fetch("/api/notifications/line", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lineUserId, message }),
      });
    } catch { /* ignore */ }
  }

  /** แจ้ง LINE ฝ่ายบัญชีว่ามีรายการรอจ่าย — ข้ามคนที่กดตรวจสอบเอง */
  async function notifyFinanceToPay(channel: "company" | "petty_cash") {
    try {
      await fetch("/api/notifications/pr-event", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prId: pr.id,
          event: "verified",
          actorId: currentUserId,
          channel,
          origin: window.location.origin,
        }),
      });
    } catch { /* ignore */ }
  }

  // ── ตรวจสอบแล้ว → verified + เลือกช่องทางจ่าย (บริษัท/เงินสดย่อย) ──
  async function handleVerify(channel: "company" | "petty_cash") {
    if (!evidence) return;
    setLoadingAction("verify");
    setErrorMsg(null);
    try {
      const { data, error } = await (supabase as any)
        .from("payment_evidences")
        .update({
          status: "verified",
          payment_channel: channel,
          reviewed_by: currentUserId,
          reviewed_at: new Date().toISOString(),
        })
        .eq("id", evidence.id)
        .eq("status", "submitted")
        .select("id");
      if (error) throw error;
      if (!data || data.length === 0) throw new Error("รายการถูกดำเนินการไปแล้ว กรุณารีเฟรช");

      logAudit({
        actorId: currentUserId,
        action: "payment_verified",
        entity: "payment_evidences",
        entityId: evidence.id,
        metadata: { pr_id: pr.id, pr_number: pr.pr_number, channel },
      });

      // แจ้งฝ่ายบัญชีคนอื่นว่ามีรายการเข้าคิวรอจ่ายตามช่องทางที่เลือก
      void notifyFinanceToPay(channel);

      router.refresh();
    } catch (err: any) {
      setErrorMsg(err?.message ?? "เกิดข้อผิดพลาด");
      setLoadingAction(null);
    }
  }

  // ── ตีกลับแก้ไข → PR = approved, evidence.status = returned ──
  async function handleReturn() {
    if (!evidence) return;
    if (!returnReason.trim()) { setErrorMsg("กรุณาระบุเหตุผล"); return; }
    setLoadingAction("return");
    setErrorMsg(null);
    try {
      const { data, error } = await (supabase as any)
        .from("purchase_requisitions")
        .update({ status: "approved" })
        .eq("id", pr.id)
        .eq("status", "pending_finance")
        .select("id");
      if (error) throw error;
      if (!data || data.length === 0) throw new Error("รายการถูกดำเนินการไปแล้ว กรุณารีเฟรช");

      // ตีกลับจาก บช. → ติดธง incomplete เพื่อให้ไปแสดงในหน้า "งานเอกสารไม่สมบูรณ์"
      await (supabase as any)
        .from("payment_evidences")
        .update({
          status: "returned",
          close_status: "incomplete",
          review_note: returnReason.trim(),
          reviewed_by: currentUserId,
          reviewed_at: new Date().toISOString(),
        })
        .eq("id", evidence.id);

      if (pr.requester_line_id) {
        const origin = typeof window !== "undefined" ? window.location.origin : "";
        void sendLine(
          pr.requester_line_id,
          `🔄 แจ้งเตือน : หลักฐานการจ่ายถูกส่งกลับเพื่อแก้ไข\n\n` +
          `เลขที่เอกสาร : ${pr.pr_number}\nรายการ : ${pr.title}\n` +
          `ตีกลับโดย : ${actorName || "ฝ่ายบัญชี"}\n` +
          `เหตุผล : ${returnReason.trim()}\n\n` +
          `กรุณาแก้ไขหลักฐานและส่งเข้าระบบอีกครั้ง\n` +
          `รายละเอียด : ${externalBrowserLink(`${origin}/requisitions/incomplete`)}`
        );
      }

      logAudit({
        actorId: currentUserId,
        action: "payment_returned",
        entity: "purchase_requisitions",
        entityId: pr.id,
        metadata: { pr_number: pr.pr_number, note: returnReason.trim(), stage: "verify", close_status: "incomplete" },
      });
      router.refresh();
    } catch (err: any) {
      setErrorMsg(err?.message ?? "เกิดข้อผิดพลาด");
      setLoadingAction(null);
    }
  }

  return (
    <div className={`overflow-hidden rounded-xl border bg-white shadow-sm ${isOverBudget ? "border-amber-300" : "border-slate-200"}`}>

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div
        className="flex cursor-pointer items-center gap-3 px-5 py-4 hover:bg-slate-50 transition-colors"
        onClick={() => setIsExpanded(o => !o)}
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5 flex-wrap">
            <Link
              href={`/requisitions/${pr.id}`}
              onClick={(e) => e.stopPropagation()}
              className="font-mono text-xs font-bold text-blue-600 tracking-wider hover:underline"
            >
              {pr.pr_number}
            </Link>
            {pr.branch_code && (
              <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${
                ({ BN: "bg-blue-600", CK: "bg-red-600", RCA: "bg-emerald-600" } as Record<string, string>)[pr.branch_code] ?? "bg-slate-500"
              } text-white`}>
                {pr.branch_code}
              </span>
            )}
            {pr.is_urgent && (
              <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-semibold text-red-600">ด่วน</span>
            )}
            {isOverBudget && (
              <span className="flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
                <AlertTriangle size={10} /> เกินงบ {budgetDiff?.toFixed(1)}%
              </span>
            )}
            {pr.status === "paid" && (
              <span className="rounded-full bg-teal-100 px-2 py-0.5 text-[10px] font-semibold text-teal-700">จ่ายแล้ว</span>
            )}
            {pr.status === "cancelled" && (
              <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-semibold text-slate-500">ยกเลิกแล้ว</span>
            )}
          </div>
          <Link
            href={`/requisitions/${pr.id}`}
            onClick={(e) => e.stopPropagation()}
            className="block truncate font-semibold text-slate-800 hover:text-blue-600 hover:underline"
          >
            {pr.title}
          </Link>
          <p className="text-xs text-slate-400 mt-0.5">
            ผู้ขอ: {pr.requester?.full_name ?? "—"} · ส่งหลักฐาน {formatDateTime(pr.submitted_at)}
          </p>
        </div>

        {/* Amount summary */}
        <div className="shrink-0 text-right">
          <p className="text-xs text-slate-400">ประมาณการ</p>
          <p className="text-sm font-medium text-slate-700">{formatCurrency(pr.total_amount)}</p>
          {actualAmount && (
            <>
              <p className="text-xs text-slate-400 mt-1">ยอดจริง</p>
              <p className={`text-sm font-bold ${isOverBudget ? "text-amber-700" : "text-green-700"}`}>
                {formatCurrency(actualAmount)}
              </p>
            </>
          )}
        </div>

        <div className="shrink-0">
          {isExpanded ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
        </div>
      </div>

      {/* ── Expanded Detail ─────────────────────────────────────────────── */}
      {isExpanded && evidence && (
        <div className="border-t border-slate-100">

          {/* ข้อมูลผู้รับเงิน */}
          <div className="grid grid-cols-3 gap-4 px-5 py-4 bg-slate-50">
            <div>
              <p className="text-xs text-slate-400 mb-0.5">ชื่อบัญชี</p>
              <p className="text-sm font-semibold text-slate-800">{evidence.account_holder_name}</p>
            </div>
            <div>
              <p className="text-xs text-slate-400 mb-0.5">ธนาคาร</p>
              <p className="text-sm font-medium text-slate-800">
                {evidence.bank_name ? (BANK_LABELS[evidence.bank_name] ?? evidence.bank_name) : "—"}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-400 mb-0.5">เลขบัญชี</p>
              <p className="text-sm font-mono font-medium text-slate-800">
                {evidence.bank_account_number ?? "—"}
              </p>
            </div>
            {evidence.notes && (
              <div className="col-span-3">
                <p className="text-xs text-slate-400 mb-0.5">หมายเหตุ</p>
                <p className="text-sm text-slate-700">{evidence.notes}</p>
              </div>
            )}
          </div>

          {/* ไฟล์แนบ */}
          {evidence.files.length > 0 && (
            <div className="px-5 py-4 border-t border-slate-100">
              <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">
                ไฟล์หลักฐาน ({evidence.files.length} ไฟล์)
              </p>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {evidence.files.map(file => {
                  const meta = FILE_TYPE_LABELS[file.evidence_type] ?? FILE_TYPE_LABELS.other;
                  const FileIcon = meta.icon;
                  const isImage = /\.(jpg|jpeg|png|webp|gif)$/i.test(file.file_name);
                  const cls = "flex w-full items-center gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-left text-sm transition hover:border-blue-300 hover:bg-blue-50";
                  const inner = (
                    <>
                      {isImage ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={file.file_url}
                          alt={file.file_name}
                          className="h-9 w-9 shrink-0 rounded object-cover border border-slate-200"
                        />
                      ) : (
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded bg-slate-100">
                          <FileIcon size={16} className={meta.color} />
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-medium text-slate-700">{file.file_name}</p>
                        <p className="text-[10px] text-slate-400">{meta.label}</p>
                      </div>
                      {isImage
                        ? <ZoomIn size={13} className="shrink-0 text-slate-300" />
                        : <ExternalLink size={12} className="shrink-0 text-slate-300" />}
                    </>
                  );

                  // รูป → เปิด lightbox ในหน้านี้ / ไฟล์อื่น (PDF) → เปิดแท็บใหม่
                  return isImage ? (
                    <button key={file.id} type="button" onClick={() => setLightboxUrl(file.file_url)} className={cls}>
                      {inner}
                    </button>
                  ) : (
                    <a key={file.id} href={file.file_url} target="_blank" rel="noopener noreferrer" className={cls}>
                      {inner}
                    </a>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── Action Buttons: ตรวจสอบแล้ว / ตีกลับแก้ไข ────────────────── */}
          <div className="border-t border-slate-100 px-5 py-4">
            {errorMsg && (
              <div className="mb-3 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                <AlertTriangle size={13} /> {errorMsg}
              </div>
            )}

            {confirmAction === "return" ? (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
                <p className="mb-2 text-sm font-medium text-amber-800">ตีกลับให้พนักงานแก้ไข — ระบุเหตุผล</p>
                <textarea
                  value={returnReason}
                  onChange={(e) => setReturnReason(e.target.value)}
                  rows={2}
                  autoFocus
                  placeholder="เช่น บิลไม่ชัด / ยอดไม่ตรง / เลขบัญชีผิด"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                />
                <div className="mt-2 flex justify-end gap-2">
                  <button
                    onClick={() => { setConfirmAction(null); setReturnReason(""); setErrorMsg(null); }}
                    disabled={!!loadingAction}
                    className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-white"
                  >
                    ยกเลิก
                  </button>
                  <button
                    onClick={handleReturn}
                    disabled={!!loadingAction}
                    className="flex items-center gap-1.5 rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-700 disabled:opacity-60"
                  >
                    {loadingAction === "return" && <Loader2 size={12} className="animate-spin" />}
                    ยืนยันตีกลับ
                  </button>
                </div>
              </div>
            ) : confirmAction === "verify" ? (
              <div className="flex flex-wrap items-center gap-3 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3">
                <CheckCircle size={16} className="shrink-0 text-blue-600" />
                <p className="flex-1 text-sm text-blue-700">
                  ตรวจแล้ว → ส่งเข้า{" "}
                  <span className="font-semibold">
                    {verifyChannel === "company" ? "บริษัทสั่งจ่าย" : "เงินสดย่อย"}
                  </span>
                  ?
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => { setConfirmAction(null); setErrorMsg(null); }}
                    disabled={!!loadingAction}
                    className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-white"
                  >
                    ยกเลิก
                  </button>
                  <button
                    onClick={() => handleVerify(verifyChannel)}
                    disabled={!!loadingAction}
                    className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
                  >
                    {loadingAction === "verify" && <Loader2 size={12} className="animate-spin" />}
                    ยืนยัน
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => { setConfirmAction("return"); setErrorMsg(null); }}
                  disabled={!!loadingAction}
                  className="flex items-center gap-1.5 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-700 transition hover:bg-amber-100 disabled:opacity-50"
                >
                  <RotateCcw size={13} /> ตีกลับแก้ไข
                </button>
                <div className="ml-auto flex items-center gap-2">
                  <button
                    onClick={() => { setVerifyChannel("petty_cash"); setConfirmAction("verify"); setErrorMsg(null); }}
                    disabled={!!loadingAction}
                    className="flex items-center gap-1.5 rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-100 disabled:opacity-50"
                  >
                    <Wallet size={13} /> เงินสดย่อย
                  </button>
                  <button
                    onClick={() => { setVerifyChannel("company"); setConfirmAction("verify"); setErrorMsg(null); }}
                    disabled={!!loadingAction}
                    className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:opacity-50"
                  >
                    <Building2 size={13} /> บริษัทสั่งจ่าย
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Lightbox แสดงรูปในหน้านี้ ─────────────────────────────────────── */}
      {lightboxUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
          onClick={() => setLightboxUrl(null)}
        >
          <button
            className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full bg-white/15 text-white transition hover:bg-white/25"
            onClick={() => setLightboxUrl(null)}
          >
            <X size={20} />
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={lightboxUrl}
            alt=""
            className="max-h-[90vh] max-w-[90vw] rounded-xl object-contain shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}
