"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import {
  Upload, FileText, ImageIcon, X as XIcon,
  AlertTriangle, CheckCircle2, Package, Paperclip,
  Wallet, Receipt, Lock,
} from "lucide-react";
import { logAudit } from "@/lib/supabase/audit";
import { formatCurrency } from "@/lib/utils/format";
import {
  BANK_FORMATS,
  getBankFormat,
  getMaskPlaceholder,
  formatAccountInput,
  isAccountComplete,
  extractDigits,
} from "@/lib/utils/bankFormats";

// ── ประเภทการชำระ ──────────────────────────────────────────────────────────────
type PaymentMode = "self_pay" | "send_bill";

// ── FileUploadZone ─────────────────────────────────────────────────────────────

/** ไฟล์ที่เคยอัปโหลดไว้ในรอบก่อน (ตอนส่งใหม่หลังถูกตีกลับ) */
export interface PreviousFile {
  id: string;
  file_name: string;
  file_url: string;
  evidence_type: string;
  file_size: number | null;
}

interface FileUploadZoneProps {
  label: string;
  description: string;
  files: File[];
  onAdd: (files: File[]) => void;
  onRemove: (index: number) => void;
  /** ไฟล์เดิมจากรอบก่อนที่ยังเก็บไว้ — ลบออกจากชุดส่งใหม่ได้ */
  existing?: PreviousFile[];
  onRemoveExisting?: (id: string) => void;
  /** คลิกรูปแล้วเด้งดูเต็มในหน้าเดียวกัน (lightbox) */
  onPreview?: (url: string) => void;
  accept?: string;
  required?: boolean;
  icon: React.ElementType;
  accentColor: string;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function FileUploadZone({
  label, description, files, onAdd, onRemove,
  existing = [], onRemoveExisting, onPreview,
  accept = "image/jpeg,image/png,image/webp,application/pdf",
  required, icon: Icon, accentColor,
}: FileUploadZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const totalCount = files.length + existing.length;

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(e.target.files ?? []);
    const dup = new Set(files.map(f => f.name + f.size));
    onAdd(selected.filter(f => !dup.has(f.name + f.size)));
    if (inputRef.current) inputRef.current.value = "";
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="mb-2 flex items-center gap-2">
        <Icon size={14} className={accentColor} />
        <span className="text-sm font-semibold text-slate-700">
          {label}
          {required && <span className="ml-1 text-red-500">*</span>}
        </span>
        {totalCount > 0 && (
          <span className={`ml-auto rounded-full px-2 py-0.5 text-[11px] font-medium ${accentColor} bg-slate-100`}>
            {totalCount} ไฟล์
          </span>
        )}
      </div>
      <p className="mb-3 text-xs text-slate-400">{description}</p>

      {/* ── รูปตัวอย่างขนาดใหญ่ — รูปแบบเดียวกับการ์ดใบเสนอราคา ── */}
      {totalCount > 0 && (
        <div className="mb-3 flex flex-wrap gap-3">
          {/* ไฟล์เดิมจากรอบก่อน */}
          {existing.map((file) => {
            const isPdf = file.file_name.toLowerCase().endsWith(".pdf");
            return (
              <div key={file.id} className="flex flex-col items-center gap-1.5">
                <div className="relative">
                  {isPdf ? (
                    <a
                      href={file.file_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex h-28 w-28 flex-col items-center justify-center gap-1 rounded-xl border border-slate-200 bg-red-50/60 shadow-sm transition hover:shadow-lg hover:ring-2 hover:ring-blue-400"
                    >
                      <FileText size={28} className="text-red-400" />
                      <span className="text-[10px] font-medium text-red-400">PDF</span>
                    </a>
                  ) : (
                    <button
                      type="button"
                      onClick={() => onPreview?.(file.file_url)}
                      title={file.file_name}
                      className="group block h-28 w-28 overflow-hidden rounded-xl border border-slate-200 bg-slate-100 shadow-sm transition-all duration-200 hover:shadow-lg hover:ring-2 hover:ring-blue-400 hover:ring-offset-2"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={file.file_url}
                        alt={file.file_name}
                        className="h-full w-full object-cover transition duration-200 group-hover:scale-105"
                      />
                    </button>
                  )}
                  <span className="absolute bottom-1 left-1 rounded bg-blue-600/90 px-1.5 py-0.5 text-[9px] font-medium text-white">
                    ไฟล์เดิม
                  </span>
                  <button
                    type="button"
                    onClick={() => onRemoveExisting?.(file.id)}
                    title="เอาไฟล์เดิมออกจากชุดที่จะส่ง"
                    className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-400 shadow transition hover:bg-red-50 hover:text-red-500"
                  >
                    <XIcon size={12} />
                  </button>
                </div>
                <p className="w-28 truncate text-center text-[11px] text-slate-500">{file.file_name}</p>
              </div>
            );
          })}

          {/* ไฟล์ใหม่ที่เพิ่งเลือก */}
          {files.map((file, i) => {
            const isImage = file.type.startsWith("image/");
            const objectUrl = URL.createObjectURL(file);
            return (
              <div key={`${file.name}-${file.size}-${i}`} className="flex flex-col items-center gap-1.5">
                <div className="relative">
                  {isImage ? (
                    <button
                      type="button"
                      onClick={() => onPreview?.(objectUrl)}
                      title={file.name}
                      className="group block h-28 w-28 overflow-hidden rounded-xl border border-slate-200 bg-slate-100 shadow-sm transition-all duration-200 hover:shadow-lg hover:ring-2 hover:ring-blue-400 hover:ring-offset-2"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={objectUrl}
                        alt={file.name}
                        className="h-full w-full object-cover transition duration-200 group-hover:scale-105"
                      />
                    </button>
                  ) : (
                    <a
                      href={objectUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex h-28 w-28 flex-col items-center justify-center gap-1 rounded-xl border border-slate-200 bg-red-50/60 shadow-sm transition hover:shadow-lg hover:ring-2 hover:ring-blue-400"
                    >
                      <FileText size={28} className="text-red-400" />
                      <span className="text-[10px] font-medium text-red-400">PDF</span>
                    </a>
                  )}
                  <button
                    type="button"
                    onClick={() => onRemove(i)}
                    className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-400 shadow transition hover:bg-red-50 hover:text-red-500"
                  >
                    <XIcon size={12} />
                  </button>
                </div>
                <div className="w-28 text-center">
                  <p className="truncate text-[11px] text-slate-500">{file.name}</p>
                  <p className="text-[10px] text-slate-400">{formatFileSize(file.size)}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <label className="flex cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-dashed border-slate-200 bg-slate-50 py-3 text-xs text-slate-400 transition-colors hover:border-blue-400 hover:bg-blue-50 hover:text-blue-500">
        <Upload size={13} /> คลิกเพื่อเพิ่มไฟล์
        <input ref={inputRef} type="file" multiple accept={accept} onChange={handleChange} className="hidden" />
      </label>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────

interface EvidenceSubmissionSectionProps {
  poId: string | null;
  prId: string;
  prBankName: string | null;
  prBankAccount: string | null;
  currentUserId: string;
  originalAmount: number;
  // ข้อมูลบัญชีจากโปรไฟล์ (สำหรับ mode ชำระด้วยตัวเอง)
  profileBankName: string | null;
  profileBankAccount: string | null;
  profileHolderName: string | null;
  /** ไฟล์จากการส่งรอบก่อน (กรณีถูกตีกลับ) — แสดงให้แก้ไข เก็บ/ลบ/เพิ่มได้ */
  previousFiles?: PreviousFile[];
  /** ข้อมูลผู้รับเงินจากการส่งรอบก่อน — เติมให้อัตโนมัติเมื่อถูกตีกลับ */
  previousData?: {
    account_holder_name: string | null;
    bank_name: string | null;
    bank_account_number: string | null;
    payment_type: string | null;
    notes: string | null;
  } | null;
}

const LS_NAMES = "evidence_account_names";
const LS_BANK  = "evidence_last_bank";

export function EvidenceSubmissionSection({
  poId, prId, prBankName, prBankAccount, currentUserId, originalAmount,
  profileBankName, profileBankAccount, profileHolderName,
  previousFiles = [],
  previousData = null,
}: EvidenceSubmissionSectionProps) {
  const router = useRouter();
  const supabase = createClient();

  // ส่งใหม่หลังถูกตีกลับ → เริ่มด้วยโหมดเดิม (self_pay ได้ต่อเมื่อโปรไฟล์มีบัญชี)
  const [paymentMode, setPaymentMode] = useState<PaymentMode>(
    previousData?.payment_type === "self_pay" && Boolean(profileBankName && profileBankAccount)
      ? "self_pay"
      : "send_bill"
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // ── ชื่อ + บัญชี (สำหรับ send_bill mode) — เติมค่าจากรอบก่อนถ้ามี ─────────
  const [savedNames, setSavedNames] = useState<string[]>([]);
  const [showNameList, setShowNameList] = useState(false);
  const [accountHolderName, setAccountHolderName] = useState(previousData?.account_holder_name ?? "");
  const [bankName, setBankName] = useState(previousData?.bank_name ?? prBankName ?? "");
  const [bankAccount, setBankAccount] = useState(previousData?.bank_account_number ?? prBankAccount ?? "");

  useEffect(() => {
    try {
      const names: string[] = JSON.parse(localStorage.getItem(LS_NAMES) ?? "[]");
      setSavedNames(names);
      const lastBank = localStorage.getItem(LS_BANK);
      if (lastBank && !prBankName && !previousData?.bank_name) setBankName(lastBank);
    } catch { /* ignore */ }
  }, [prBankName, previousData?.bank_name]);

  const [notes, setNotes] = useState(previousData?.notes ?? "");
  const [billFiles, setBillFiles] = useState<File[]>([]);
  const [slipFiles, setSlipFiles] = useState<File[]>([]);
  const [goodsReceiptFiles, setGoodsReceiptFiles] = useState<File[]>([]);

  // รูปที่กำลังเปิดดูเต็มจอ (lightbox)
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  // ไฟล์เดิมจากรอบก่อนที่ยัง "เก็บไว้" — ผู้ใช้กด ✕ เพื่อเอาออกจากชุดที่จะส่งใหม่ได้
  const [keptPrevFiles, setKeptPrevFiles] = useState<PreviousFile[]>(
    () => previousFiles.filter((f) => ["bill", "slip", "goods_receipt"].includes(f.evidence_type))
  );
  function removePrevFile(id: string) {
    setKeptPrevFiles((prev) => prev.filter((f) => f.id !== id));
  }
  const prevBills  = keptPrevFiles.filter((f) => f.evidence_type === "bill");
  const prevSlips  = keptPrevFiles.filter((f) => f.evidence_type === "slip");
  const prevGoods  = keptPrevFiles.filter((f) => f.evidence_type === "goods_receipt");

  // ── bank format (send_bill mode) ───────────────────────────────────────────
  const selectedFmt = getBankFormat(bankName);
  const rawDigits = extractDigits(bankAccount);
  const accountComplete = bankName
    ? isAccountComplete(bankAccount, bankName)
    : bankAccount.trim().length > 0;
  const digitsLeft = selectedFmt ? selectedFmt.digits - rawDigits.length : 0;

  function handleAccountInput(raw: string) {
    setBankAccount(formatAccountInput(raw, bankName));
  }

  function handleBankNameChange(code: string) {
    setBankName(code);
    setBankAccount(""); // reset เมื่อเปลี่ยนธนาคาร
  }

  // ── ตรวจว่า self_pay mode พร้อมหรือไม่ ────────────────────────────────────
  const hasSelfPayAccount = !!(profileBankName && profileBankAccount);

  function addFiles(setter: React.Dispatch<React.SetStateAction<File[]>>) {
    return (files: File[]) => setter(prev => [...prev, ...files]);
  }
  function removeFile(setter: React.Dispatch<React.SetStateAction<File[]>>) {
    return (index: number) => setter(prev => prev.filter((_, i) => i !== index));
  }

  async function uploadFiles(evidenceId: string, files: File[], evidenceType: "bill" | "slip" | "goods_receipt") {
    for (const file of files) {
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const path = `${evidenceId}/${evidenceType}_${Date.now()}_${safeName}`;
      const { error: uploadErr } = await supabase.storage
        .from("evidence-attachments")
        .upload(path, file, { upsert: false });
      if (uploadErr) throw new Error(`อัปโหลด "${file.name}" ไม่สำเร็จ: ${uploadErr.message}`);
      const { data: { publicUrl } } = supabase.storage.from("evidence-attachments").getPublicUrl(path);
      await (supabase as any).from("evidence_files").insert({
        evidence_id: evidenceId,
        file_name: file.name,
        file_url: publicUrl,
        evidence_type: evidenceType,
        file_size: file.size,
        uploaded_by: currentUserId,
      });
    }
  }

  /** แจ้ง LINE ฝ่ายบัญชีว่ามีหลักฐานรอตรวจสอบ — เซิร์ฟเวอร์หาผู้รับและประกอบข้อความเอง */
  async function notifyFinanceToVerify() {
    try {
      await fetch("/api/notifications/pr-event", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prId,
          event: "evidence_submitted",
          actorId: currentUserId,
          origin: window.location.origin,
        }),
      });
    } catch {
      // ไม่ block flow หลัก ถ้า notification ส่งไม่สำเร็จ
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    // validation ตาม mode
    if (paymentMode === "send_bill") {
      if (!accountHolderName.trim()) { setErrorMessage("กรุณาระบุชื่อเจ้าของบัญชี"); return; }
      if (bankName && !accountComplete) { setErrorMessage(`กรุณากรอกเลขบัญชีให้ครบ (ยังขาดอีก ${digitsLeft} หลัก)`); return; }
    }
    if (paymentMode === "self_pay" && !hasSelfPayAccount) {
      setErrorMessage("กรุณาเพิ่มบัญชีธนาคารในโปรไฟล์ก่อน");
      return;
    }
    // นับไฟล์เดิมที่เก็บไว้รวมกับไฟล์ใหม่ (กรณีส่งซ้ำหลังถูกตีกลับ)
    if (billFiles.length + prevBills.length === 0)         { setErrorMessage("กรุณาแนบบิล / ใบเสร็จ อย่างน้อย 1 ไฟล์"); return; }
    if (goodsReceiptFiles.length + prevGoods.length === 0) { setErrorMessage("กรุณาแนบรูปถ่ายการรับของ อย่างน้อย 1 ไฟล์"); return; }
    if (paymentMode === "self_pay" && slipFiles.length + prevSlips.length === 0) {
      setErrorMessage("กรุณาแนบสลิปการโอนเงินที่ชำระไปแล้ว");
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    // เลือกข้อมูลบัญชีตาม mode
    const insertHolderName = paymentMode === "self_pay"
      ? (profileHolderName ?? "")
      : accountHolderName.trim();
    const insertBankName   = paymentMode === "self_pay" ? (profileBankName ?? null) : (bankName || null);
    const insertBankAcct   = paymentMode === "self_pay" ? (profileBankAccount ?? null) : (bankAccount.trim() || null);

    try {
      const { data: evidence, error: evidenceError } = await (supabase as any)
        .from("payment_evidences")
        .insert({
          po_id: poId,
          pr_id: prId,
          account_holder_name: insertHolderName,
          bank_name: insertBankName,
          bank_account_number: insertBankAcct,
          notes: notes.trim() || null,
          payment_type: paymentMode,
          submitted_by: currentUserId,
        })
        .select("id")
        .single();

      if (evidenceError || !evidence) throw evidenceError ?? new Error("ไม่สามารถสร้างข้อมูลหลักฐานได้");

      // คัดลอกไฟล์เดิมที่เก็บไว้เข้าชุดใหม่ (อ้างไฟล์เดียวกันใน storage ไม่อัปโหลดซ้ำ)
      if (keptPrevFiles.length > 0) {
        const { error: copyError } = await (supabase as any).from("evidence_files").insert(
          keptPrevFiles.map((f) => ({
            evidence_id: evidence.id,
            file_name: f.file_name,
            file_url: f.file_url,
            evidence_type: f.evidence_type,
            file_size: f.file_size,
            uploaded_by: currentUserId,
          }))
        );
        if (copyError) throw new Error(`คัดลอกไฟล์เดิมไม่สำเร็จ: ${copyError.message}`);
      }

      if (billFiles.length > 0)         await uploadFiles(evidence.id, billFiles, "bill");
      if (slipFiles.length > 0)         await uploadFiles(evidence.id, slipFiles, "slip");
      if (goodsReceiptFiles.length > 0) await uploadFiles(evidence.id, goodsReceiptFiles, "goods_receipt");

      const { error: prUpdateError } = await (supabase as any)
        .from("purchase_requisitions")
        .update({ status: "pending_finance", actual_amount: originalAmount })
        .eq("id", prId);

      if (prUpdateError) {
        await (supabase as any)
          .from("purchase_requisitions")
          .update({ actual_amount: originalAmount })
          .eq("id", prId);
      }

      logAudit({
        actorId: currentUserId,
        action: "payment_evidence_submitted",
        entity: "payment_evidences",
        entityId: evidence.id,
        metadata: { pr_id: prId, payment_type: paymentMode, account_holder_name: insertHolderName },
      });

      // แจ้งฝ่ายบัญชีว่ามีงานเข้าคิวตรวจสอบ
      void notifyFinanceToVerify();

      // บันทึกชื่อและธนาคารลง localStorage (เฉพาะ send_bill)
      if (paymentMode === "send_bill") {
        try {
          const trimmedName = accountHolderName.trim();
          const existing: string[] = JSON.parse(localStorage.getItem(LS_NAMES) ?? "[]");
          if (trimmedName && !existing.includes(trimmedName)) {
            localStorage.setItem(LS_NAMES, JSON.stringify([trimmedName, ...existing]));
          }
          if (bankName) localStorage.setItem(LS_BANK, bankName);
        } catch { /* ignore */ }
      }

      router.refresh();
    } catch (err: unknown) {
      setErrorMessage((err as Error).message ?? "เกิดข้อผิดพลาด");
      setIsSubmitting(false);
    }
  }

  const bankLabel = BANK_FORMATS.find(b => b.code === profileBankName)?.label ?? profileBankName;

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      {/* header */}
      <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-100">
        <Paperclip size={16} className="text-blue-600" />
        <span className="text-sm font-semibold text-slate-700">แนบหลักฐานการรับของ</span>
      </div>

      <form onSubmit={handleSubmit} className="divide-y divide-slate-100">

        {/* ── เลือกรูปแบบการชำระ ── */}
        <div className="px-5 py-4">
          <p className="mb-2 text-xs font-semibold text-slate-500 uppercase tracking-wide">รูปแบบการชำระเงิน</p>
          <div className="grid grid-cols-2 gap-2">

            {/* ปุ่ม 1: ชำระด้วยตัวเอง */}
            <button
              type="button"
              onClick={() => !(!hasSelfPayAccount) && setPaymentMode("self_pay")}
              disabled={!hasSelfPayAccount}
              className={`relative flex flex-col items-start gap-1 rounded-xl border-2 p-3 text-left transition-colors ${
                paymentMode === "self_pay"
                  ? "border-blue-500 bg-blue-50"
                  : hasSelfPayAccount
                  ? "border-slate-200 hover:border-slate-300 bg-white"
                  : "border-slate-200 bg-slate-50 opacity-60 cursor-not-allowed"
              }`}
            >
              {!hasSelfPayAccount && (
                <Lock size={12} className="absolute top-2 right-2 text-slate-400" />
              )}
              <Wallet size={16} className={paymentMode === "self_pay" ? "text-blue-600" : "text-slate-400"} />
              <span className={`text-xs font-semibold ${paymentMode === "self_pay" ? "text-blue-700" : "text-slate-700"}`}>
                ชำระด้วยตัวเอง
              </span>
              <span className="text-[10px] text-slate-400 leading-snug">
                {hasSelfPayAccount ? "ขอเบิกคืนผ่านบัญชีในโปรไฟล์" : "ต้องเพิ่มบัญชีในโปรไฟล์ก่อน"}
              </span>
            </button>

            {/* ปุ่ม 2: ส่งบิลจ่าย */}
            <button
              type="button"
              onClick={() => setPaymentMode("send_bill")}
              className={`flex flex-col items-start gap-1 rounded-xl border-2 p-3 text-left transition-colors ${
                paymentMode === "send_bill"
                  ? "border-blue-500 bg-blue-50"
                  : "border-slate-200 hover:border-slate-300 bg-white"
              }`}
            >
              <Receipt size={16} className={paymentMode === "send_bill" ? "text-blue-600" : "text-slate-400"} />
              <span className={`text-xs font-semibold ${paymentMode === "send_bill" ? "text-blue-700" : "text-slate-700"}`}>
                ส่งบิลจ่าย
              </span>
              <span className="text-[10px] text-slate-400 leading-snug">
                กรอกบัญชีผู้รับเงิน บช. โอนให้
              </span>
            </button>
          </div>

          {/* แจ้งให้ไปเพิ่มบัญชี */}
          {!hasSelfPayAccount && (
            <div className="mt-2 flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
              <AlertTriangle size={13} className="text-amber-500 shrink-0" />
              <p className="text-xs text-amber-700">
                ยังไม่มีบัญชีธนาคาร —{" "}
                <Link href="/profile" className="font-medium underline hover:text-amber-900">
                  เพิ่มในโปรไฟล์
                </Link>
              </p>
            </div>
          )}
        </div>

        {/* ── ข้อมูลผู้รับเงิน ── */}
        <div className="px-5 py-4">
          <h3 className="mb-3 text-sm font-semibold text-slate-700">ข้อมูลผู้รับเงิน</h3>

          {paymentMode === "self_pay" ? (
            /* ── โชว์ข้อมูลจากโปรไฟล์ (read-only) ── */
            hasSelfPayAccount ? (
              <div className="rounded-lg border border-blue-100 bg-blue-50 px-4 py-3">
                <p className="text-xs text-blue-500 mb-1">บัญชีของคุณ (จากโปรไฟล์)</p>
                <p className="font-semibold text-slate-800">{profileHolderName || "—"}</p>
                <p className="text-sm text-slate-600 mt-0.5">
                  {bankLabel} · <span className="font-mono tracking-wider">{profileBankAccount}</span>
                </p>
              </div>
            ) : (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
                กรุณาเพิ่มบัญชีธนาคารในโปรไฟล์ก่อนใช้ตัวเลือกนี้
              </div>
            )
          ) : (
            /* ── send_bill: ฟอร์มกรอกบัญชี ── */
            <div className="space-y-3">
              {/* ชื่อ */}
              <div className="relative">
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  ชื่อเจ้าของบัญชี <span className="text-red-500">*</span>
                </label>
                <input
                  value={accountHolderName}
                  onChange={e => { setAccountHolderName(e.target.value); setShowNameList(true); }}
                  onFocus={() => setShowNameList(true)}
                  onBlur={() => setTimeout(() => setShowNameList(false), 150)}
                  placeholder="ชื่อ-นามสกุล ตามหน้าบัญชี"
                  autoComplete="off"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                />
                {showNameList && savedNames.length > 0 && (
                  <ul className="absolute z-10 mt-1 w-full rounded-lg border border-slate-200 bg-white shadow-md">
                    {savedNames
                      .filter(n => !accountHolderName || n.toLowerCase().includes(accountHolderName.toLowerCase()))
                      .slice(0, 5)
                      .map(name => (
                        <li
                          key={name}
                          onMouseDown={() => { setAccountHolderName(name); setShowNameList(false); }}
                          className="cursor-pointer px-3 py-2 text-sm text-slate-700 hover:bg-blue-50 hover:text-blue-700"
                        >
                          {name}
                        </li>
                      ))}
                  </ul>
                )}
              </div>

              {/* ธนาคาร + เลขบัญชี */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">ธนาคาร</label>
                  <select
                    value={bankName}
                    onChange={e => handleBankNameChange(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 focus:border-blue-500 focus:outline-none"
                  >
                    <option value="">— เลือกธนาคาร —</option>
                    {BANK_FORMATS.map(b => (
                      <option key={b.code} value={b.code}>{b.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">เลขที่บัญชี</label>
                  <input
                    value={bankAccount}
                    onChange={e => handleAccountInput(e.target.value)}
                    inputMode="numeric"
                    placeholder={selectedFmt ? getMaskPlaceholder(selectedFmt.mask) : "เช่น 000-0-00000-0"}
                    className={`w-full rounded-lg border px-3 py-2 text-sm font-mono tracking-wider focus:outline-none ${
                      bankAccount && !accountComplete
                        ? "border-amber-400 focus:border-amber-500"
                        : "border-slate-300 focus:border-blue-500"
                    }`}
                  />
                  {bankName && selectedFmt && (
                    <p className="mt-1 text-[11px] text-slate-400">
                      {getMaskPlaceholder(selectedFmt.mask)}
                      {bankAccount && !accountComplete && (
                        <span className="ml-2 text-amber-600">ขาดอีก {digitsLeft} หลัก</span>
                      )}
                      {bankAccount && accountComplete && (
                        <span className="ml-2 text-green-600 font-medium">✓</span>
                      )}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── ไฟล์หลักฐาน ── */}
        <div className="px-5 py-4">
          <h3 className="mb-1 text-sm font-semibold text-slate-700">ไฟล์หลักฐาน</h3>
          <p className="mb-3 text-xs text-slate-400">
            {paymentMode === "self_pay"
              ? "แนบบิล + สลิปที่ชำระไปแล้ว + รูปถ่ายรับของ"
              : "แนบบิลอย่างน้อย 1 ไฟล์ + รูปถ่ายรับของ"}
          </p>
          <div className="space-y-3">
            <FileUploadZone
              label="บิล / ใบเสร็จ"
              description="ใบเสร็จหรือบิลจากร้านค้า"
              files={billFiles}
              onAdd={addFiles(setBillFiles)}
              onRemove={removeFile(setBillFiles)}
              existing={prevBills}
              onRemoveExisting={removePrevFile}
              onPreview={setLightboxUrl}
              required
              icon={FileText}
              accentColor="text-orange-500"
            />
            <FileUploadZone
              label={paymentMode === "self_pay" ? "สลิปการโอนเงิน *" : "สลิปการโอนเงิน"}
              description={paymentMode === "self_pay" ? "หลักฐานว่าคุณชำระเงินไปแล้ว (บังคับ)" : "หลักฐานการชำระเงิน (ถ้ามี)"}
              files={slipFiles}
              onAdd={addFiles(setSlipFiles)}
              onRemove={removeFile(setSlipFiles)}
              existing={prevSlips}
              onRemoveExisting={removePrevFile}
              onPreview={setLightboxUrl}
              required={paymentMode === "self_pay"}
              icon={ImageIcon}
              accentColor="text-blue-500"
            />
            <FileUploadZone
              label="รูปถ่ายการรับของ"
              description="ภาพถ่ายสินค้าที่รับมาจริง"
              files={goodsReceiptFiles}
              onAdd={addFiles(setGoodsReceiptFiles)}
              onRemove={removeFile(setGoodsReceiptFiles)}
              existing={prevGoods}
              onRemoveExisting={removePrevFile}
              onPreview={setLightboxUrl}
              required
              icon={Package}
              accentColor="text-green-500"
            />
          </div>
        </div>

        {/* ── หมายเหตุ ── */}
        <div className="px-5 py-4">
          <label className="mb-2 block text-sm font-semibold text-slate-700">หมายเหตุ (ถ้ามี)</label>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            rows={2}
            placeholder="ข้อมูลเพิ่มเติมสำหรับฝ่ายการเงิน"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
          />
        </div>

        {/* ── Summary + Submit ── */}
        <div className="px-5 py-4">
          <div className="mb-3 flex flex-wrap gap-3 rounded-lg border border-blue-100 bg-blue-50 px-4 py-3 text-xs text-blue-700">
            <span className={billFiles.length + prevBills.length > 0 ? "font-semibold text-green-700" : "font-semibold text-red-500"}>
              {billFiles.length + prevBills.length > 0
                ? <><CheckCircle2 size={11} className="mr-1 inline text-green-600" />บิล {billFiles.length + prevBills.length} ไฟล์</>
                : <><AlertTriangle size={11} className="mr-1 inline" />ยังไม่มีบิล *</>}
            </span>
            {paymentMode === "self_pay" && (
              <span className={slipFiles.length + prevSlips.length > 0 ? "font-semibold text-green-700" : "font-semibold text-red-500"}>
                {slipFiles.length + prevSlips.length > 0
                  ? <><CheckCircle2 size={11} className="mr-1 inline text-green-600" />สลิป {slipFiles.length + prevSlips.length} ไฟล์</>
                  : <><AlertTriangle size={11} className="mr-1 inline" />ยังไม่มีสลิป *</>}
              </span>
            )}
            <span className={goodsReceiptFiles.length + prevGoods.length > 0 ? "font-semibold text-green-700" : "font-semibold text-red-500"}>
              {goodsReceiptFiles.length + prevGoods.length > 0
                ? <><CheckCircle2 size={11} className="mr-1 inline text-green-600" />รูปรับของ {goodsReceiptFiles.length + prevGoods.length} ไฟล์</>
                : <><AlertTriangle size={11} className="mr-1 inline" />ยังไม่มีรูปรับของ *</>}
            </span>
            <span className="ml-auto font-semibold text-blue-800">
              ยอดรวม: {formatCurrency(originalAmount)}
            </span>
          </div>

          {errorMessage && (
            <div className="mb-3 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3">
              <AlertTriangle size={14} className="text-red-500" />
              <p className="text-sm text-red-700">{errorMessage}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitting || (paymentMode === "self_pay" && !hasSelfPayAccount)}
            className="w-full rounded-lg bg-blue-600 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:opacity-60"
          >
            {isSubmitting
              ? "กำลังส่ง..."
              : paymentMode === "self_pay"
              ? "ส่งขอเบิกเงินคืน →"
              : "ส่งแนบจ่าย →"}
          </button>
        </div>

      </form>

      {/* ── Lightbox (รูปแบบมาตรฐานเดียวกับหน้าอื่นทั้งระบบ) ─────────────────── */}
      {lightboxUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
          onClick={() => setLightboxUrl(null)}
        >
          <button
            type="button"
            className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full bg-white/15 text-white transition hover:bg-white/25"
            onClick={() => setLightboxUrl(null)}
          >
            <XIcon size={20} />
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
