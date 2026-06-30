"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  ChevronDown, ChevronUp, AlertTriangle,
  FileText, ImageIcon, Package, ExternalLink,
  RotateCcw, XCircle, Banknote,
} from "lucide-react";
import { formatCurrency, formatDateTime } from "@/lib/utils/format";

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
  total_amount: number;
  actual_amount: number | null;
  is_urgent: boolean;
  created_at: string;
  requester: { full_name: string } | null;
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
}

export function DisbursementItem({ pr }: DisbursementItemProps) {
  const router = useRouter();
  const supabase = createClient();
  const [isExpanded, setIsExpanded] = useState(false);
  const [loadingAction, setLoadingAction] = useState<"return" | "cancel" | "approve" | null>(null);
  const [confirmAction, setConfirmAction] = useState<"return" | "cancel" | "approve" | null>(null);

  const evidence = pr.evidence;
  const actualAmount = evidence?.actual_amount ?? pr.actual_amount ?? null;
  const budgetDiff = actualAmount && pr.total_amount
    ? ((actualAmount - pr.total_amount) / pr.total_amount) * 100
    : null;
  const isOverBudget = budgetDiff !== null && budgetDiff > 10;

  async function handleReturn() {
    setLoadingAction("return");
    try {
      // ลบ evidence record (cascade ลบ evidence_files ด้วย)
      if (evidence) {
        await (supabase as any).from("payment_evidences").delete().eq("id", evidence.id);
      }
      // คืนสถานะ PR กลับเป็น approved ให้ผู้ขอแนบใหม่
      await (supabase as any)
        .from("purchase_requisitions")
        .update({ status: "approved", actual_amount: null })
        .eq("id", pr.id);
      router.refresh();
    } catch {
      setLoadingAction(null);
    }
  }

  async function handleCancel() {
    setLoadingAction("cancel");
    try {
      await (supabase as any)
        .from("purchase_requisitions")
        .update({ status: "cancelled" })
        .eq("id", pr.id);
      router.refresh();
    } catch {
      setLoadingAction(null);
    }
  }

  async function handleApprove() {
    setLoadingAction("approve");
    try {
      await (supabase as any)
        .from("purchase_requisitions")
        .update({ status: "paid", finance_action_at: new Date().toISOString() })
        .eq("id", pr.id);
      router.refresh();
    } catch {
      setLoadingAction(null);
    }
  }

  function executeConfirmed() {
    if (confirmAction === "return") handleReturn();
    else if (confirmAction === "cancel") handleCancel();
    else if (confirmAction === "approve") handleApprove();
    setConfirmAction(null);
  }

  return (
    <div className={`overflow-hidden rounded-xl border bg-white shadow-sm ${isOverBudget ? "border-amber-300" : "border-slate-200"}`}>

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div
        className="flex cursor-pointer items-center gap-3 px-5 py-4 hover:bg-slate-50 transition-colors"
        onClick={() => setIsExpanded(o => !o)}
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="font-mono text-xs font-bold text-slate-500 tracking-wider">
              {pr.pr_number}
            </span>
            {pr.is_urgent && (
              <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-semibold text-red-600">ด่วน</span>
            )}
            {isOverBudget && (
              <span className="flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
                <AlertTriangle size={10} /> เกินงบ {budgetDiff?.toFixed(1)}%
              </span>
            )}
          </div>
          <p className="font-semibold text-slate-800 truncate">{pr.title}</p>
          <p className="text-xs text-slate-400 mt-0.5">
            ผู้ขอ: {pr.requester?.full_name ?? "—"} · ส่งหลักฐาน {formatDateTime(evidence?.submitted_at ?? pr.created_at)}
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
                  return (
                    <a
                      key={file.id}
                      href={file.file_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm transition hover:border-blue-300 hover:bg-blue-50"
                    >
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
                      <ExternalLink size={12} className="shrink-0 text-slate-300" />
                    </a>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── Action Buttons ─────────────────────────────────────────── */}
          <div className="border-t border-slate-100 px-5 py-4">
            {confirmAction ? (
              <div className="flex items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
                <AlertTriangle size={16} className="shrink-0 text-amber-600" />
                <p className="flex-1 text-sm text-amber-700">
                  {confirmAction === "return" && "ยืนยันตีกลับ? หลักฐานจะถูกลบและผู้ขอต้องแนบใหม่"}
                  {confirmAction === "cancel" && "ยืนยันยกเลิก? รายการนี้จะถูกยกเลิกถาวร"}
                  {confirmAction === "approve" && "ยืนยันอนุมัติจ่าย? สถานะจะเปลี่ยนเป็น \"จ่ายแล้ว\""}
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setConfirmAction(null)}
                    className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-white"
                  >
                    ยกเลิก
                  </button>
                  <button
                    onClick={executeConfirmed}
                    disabled={!!loadingAction}
                    className={`rounded-lg px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60 ${
                      confirmAction === "approve" ? "bg-teal-600 hover:bg-teal-700" : "bg-red-500 hover:bg-red-600"
                    }`}
                  >
                    {loadingAction ? "กำลังดำเนินการ..." : "ยืนยัน"}
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setConfirmAction("return")}
                  disabled={!!loadingAction}
                  className="flex items-center gap-1.5 rounded-lg border border-orange-300 bg-orange-50 px-3 py-2 text-xs font-semibold text-orange-700 transition hover:bg-orange-100 disabled:opacity-50"
                >
                  <RotateCcw size={13} /> ตีกลับ
                </button>
                <button
                  onClick={() => setConfirmAction("cancel")}
                  disabled={!!loadingAction}
                  className="flex items-center gap-1.5 rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 transition hover:bg-red-100 disabled:opacity-50"
                >
                  <XCircle size={13} /> ยกเลิก
                </button>
                <button
                  onClick={() => setConfirmAction("approve")}
                  disabled={!!loadingAction}
                  className="ml-auto flex items-center gap-1.5 rounded-lg bg-teal-600 px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-teal-700 disabled:opacity-50"
                >
                  <Banknote size={13} /> อนุมัติจ่าย
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
