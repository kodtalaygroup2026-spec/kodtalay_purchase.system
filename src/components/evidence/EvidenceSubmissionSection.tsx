"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  Upload, FileText, ImageIcon, X as XIcon,
  AlertTriangle, CheckCircle2, Package,
} from "lucide-react";

const THAI_BANKS = [
  { code: "KBANK", label: "กสิกรไทย (KBANK)" },
  { code: "SCB",   label: "ไทยพาณิชย์ (SCB)" },
  { code: "BBL",   label: "กรุงเทพ (BBL)" },
  { code: "KTB",   label: "กรุงไทย (KTB)" },
  { code: "TTB",   label: "ทีทีบี (TTB)" },
  { code: "BAY",   label: "กรุงศรีอยุธยา (BAY)" },
  { code: "GSB",   label: "ออมสิน (GSB)" },
  { code: "GHB",   label: "อาคารสงเคราะห์ (GHB)" },
  { code: "BAAC",  label: "ธ.ก.ส. (BAAC)" },
  { code: "KKP",   label: "เกียรตินาคิน (KKP)" },
  { code: "CIMBT", label: "ซีไอเอ็มบี (CIMBT)" },
  { code: "UOB",   label: "ยูโอบี (UOB)" },
  { code: "TISCO", label: "ทิสโก้ (TISCO)" },
  { code: "LHB",   label: "แลนด์แอนด์เฮ้าส์ (LHB)" },
];

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

interface FileUploadZoneProps {
  label: string;
  description: string;
  files: File[];
  onAdd: (files: File[]) => void;
  onRemove: (index: number) => void;
  accept?: string;
  required?: boolean;
  icon: React.ElementType;
  accentColor: string;
}

function FileUploadZone({
  label, description, files, onAdd, onRemove,
  accept = "image/jpeg,image/png,image/webp,application/pdf",
  required, icon: Icon, accentColor,
}: FileUploadZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(e.target.files ?? []);
    const existing = new Set(files.map(f => f.name + f.size));
    onAdd(selected.filter(f => !existing.has(f.name + f.size)));
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
        {files.length > 0 && (
          <span className={`ml-auto rounded-full px-2 py-0.5 text-[11px] font-medium ${accentColor} bg-slate-100`}>
            {files.length} ไฟล์
          </span>
        )}
      </div>
      <p className="mb-3 text-xs text-slate-400">{description}</p>

      {/* Uploaded list */}
      {files.length > 0 && (
        <ul className="mb-3 space-y-1.5">
          {files.map((file, i) => {
            const isImage = file.type.startsWith("image/");
            const previewUrl = isImage ? URL.createObjectURL(file) : null;
            return (
              <li key={i} className="flex items-center gap-2 rounded-md border border-slate-100 bg-slate-50 px-2.5 py-1.5">
                {previewUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={previewUrl} alt={file.name}
                    className="h-8 w-8 shrink-0 rounded object-cover border border-slate-200" />
                ) : (
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-red-50">
                    <FileText size={14} className="text-red-400" />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-medium text-slate-700">{file.name}</p>
                  <p className="text-[10px] text-slate-400">{formatFileSize(file.size)}</p>
                </div>
                <button type="button" onClick={() => onRemove(i)}
                  className="shrink-0 rounded p-1 text-slate-300 hover:bg-red-50 hover:text-red-500 transition-colors">
                  <XIcon size={12} />
                </button>
              </li>
            );
          })}
        </ul>
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
  poId: string;
  prId: string;
  prBankName: string | null;
  prBankAccount: string | null;
  currentUserId: string;
}

export function EvidenceSubmissionSection({
  poId, prId, prBankName, prBankAccount, currentUserId,
}: EvidenceSubmissionSectionProps) {
  const router = useRouter();
  const supabase = createClient();

  const [isOpen, setIsOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // ── ข้อมูลผู้รับเงิน ────────────────────────────────────────────────────────
  const [accountHolderName, setAccountHolderName] = useState("");
  const [bankName, setBankName] = useState(prBankName ?? "");
  const [bankAccount, setBankAccount] = useState(prBankAccount ?? "");
  const [notes, setNotes] = useState("");

  // ── ไฟล์แนบแยกประเภท ────────────────────────────────────────────────────────
  const [billFiles, setBillFiles] = useState<File[]>([]);
  const [slipFiles, setSlipFiles] = useState<File[]>([]);
  const [goodsReceiptFiles, setGoodsReceiptFiles] = useState<File[]>([]);

  function addFiles(setter: React.Dispatch<React.SetStateAction<File[]>>) {
    return (files: File[]) => setter(prev => [...prev, ...files]);
  }
  function removeFile(setter: React.Dispatch<React.SetStateAction<File[]>>) {
    return (index: number) => setter(prev => prev.filter((_, i) => i !== index));
  }

  async function uploadFiles(
    evidenceId: string,
    files: File[],
    evidenceType: "bill" | "slip" | "goods_receipt",
  ) {
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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!accountHolderName.trim()) { setErrorMessage("กรุณาระบุชื่อเจ้าของบัญชี"); return; }
    if (billFiles.length === 0) { setErrorMessage("กรุณาแนบบิลอย่างน้อย 1 ไฟล์"); return; }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      // 1. สร้าง evidence record
      const { data: evidence, error: evidenceError } = await (supabase as any)
        .from("payment_evidences")
        .insert({
          po_id: poId,
          pr_id: prId,
          account_holder_name: accountHolderName.trim(),
          bank_name: bankName || null,
          bank_account_number: bankAccount.trim() || null,
          notes: notes.trim() || null,
          submitted_by: currentUserId,
        })
        .select("id")
        .single();

      if (evidenceError || !evidence) throw evidenceError ?? new Error("ไม่สามารถสร้างข้อมูลหลักฐานได้");

      // 2. อัปโหลดไฟล์แยกตามประเภท
      await uploadFiles(evidence.id, billFiles, "bill");
      await uploadFiles(evidence.id, slipFiles, "slip");
      await uploadFiles(evidence.id, goodsReceiptFiles, "goods_receipt");

      router.refresh();
    } catch (err: unknown) {
      setErrorMessage((err as Error).message ?? "เกิดข้อผิดพลาด");
      setIsSubmitting(false);
    }
  }

  // ── Collapsed ────────────────────────────────────────────────────────────────
  if (!isOpen) {
    return (
      <div className="rounded-xl border-2 border-dashed border-blue-300 bg-blue-50 px-6 py-8 text-center">
        <Package size={28} className="mx-auto mb-2 text-blue-400" />
        <p className="mb-1 font-semibold text-blue-800">PO ได้รับการอนุมัติแล้ว</p>
        <p className="mb-4 text-sm text-blue-600">
          กรุณาแนบหลักฐานการรับของและระบุข้อมูลบัญชีสำหรับรับเงิน
        </p>
        <button
          onClick={() => setIsOpen(true)}
          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-blue-700"
        >
          <Upload size={15} /> ส่งหลักฐานการรับของ
        </button>
      </div>
    );
  }

  // ── Expanded: full form ───────────────────────────────────────────────────────
  return (
    <form onSubmit={handleSubmit} className="space-y-5">

      {/* ── ข้อมูลผู้รับเงิน ─────────────────────────────────────────────── */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="mb-4 font-semibold text-slate-700">ข้อมูลผู้รับเงิน</h2>
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              ชื่อเจ้าของบัญชี <span className="text-red-500">*</span>
            </label>
            <input
              value={accountHolderName}
              onChange={e => setAccountHolderName(e.target.value)}
              placeholder="ชื่อ-นามสกุล ตามหน้าบัญชี"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">ธนาคาร</label>
              <select
                value={bankName}
                onChange={e => setBankName(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 focus:border-blue-500 focus:outline-none"
              >
                <option value="">— เลือกธนาคาร —</option>
                {THAI_BANKS.map(b => (
                  <option key={b.code} value={b.code}>{b.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">เลขที่บัญชี</label>
              <input
                value={bankAccount}
                onChange={e => setBankAccount(e.target.value)}
                placeholder="เช่น 123-4-56789-0"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono tracking-wider focus:border-blue-500 focus:outline-none"
              />
            </div>
          </div>
        </div>
      </div>

      {/* ── ไฟล์แนบหลักฐาน ───────────────────────────────────────────────── */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="mb-1 font-semibold text-slate-700">ไฟล์หลักฐาน</h2>
        <p className="mb-4 text-xs text-slate-400">แนบบิลอย่างน้อย 1 ไฟล์ — สลิปและรูปรับของไม่บังคับ</p>

        <div className="space-y-3">
          <FileUploadZone
            label="บิล / ใบเสร็จ"
            description="ใบเสร็จหรือบิลจากร้านค้า"
            files={billFiles}
            onAdd={addFiles(setBillFiles)}
            onRemove={removeFile(setBillFiles)}
            required
            icon={FileText}
            accentColor="text-orange-500"
          />
          <FileUploadZone
            label="สลิปการโอนเงิน"
            description="หลักฐานการชำระเงิน / สลิปโอนเงิน"
            files={slipFiles}
            onAdd={addFiles(setSlipFiles)}
            onRemove={removeFile(setSlipFiles)}
            icon={ImageIcon}
            accentColor="text-blue-500"
          />
          <FileUploadZone
            label="รูปถ่ายการรับของ"
            description="ภาพถ่ายสินค้าที่รับมาจริง"
            files={goodsReceiptFiles}
            onAdd={addFiles(setGoodsReceiptFiles)}
            onRemove={removeFile(setGoodsReceiptFiles)}
            icon={Package}
            accentColor="text-green-500"
          />
        </div>
      </div>

      {/* ── หมายเหตุ ──────────────────────────────────────────────────────── */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <label className="mb-2 block font-semibold text-slate-700">หมายเหตุ (ถ้ามี)</label>
        <textarea
          value={notes}
          onChange={e => setNotes(e.target.value)}
          rows={2}
          placeholder="ข้อมูลเพิ่มเติมสำหรับฝ่ายการเงิน"
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
        />
      </div>

      {/* ── Summary box ───────────────────────────────────────────────────── */}
      <div className="rounded-lg border border-blue-100 bg-blue-50 px-4 py-3">
        <div className="flex flex-wrap gap-3 text-xs text-blue-700">
          <span className={billFiles.length > 0 ? "font-semibold text-green-700" : "text-slate-400"}>
            {billFiles.length > 0
              ? <CheckCircle2 size={11} className="mr-1 inline text-green-600" />
              : <AlertTriangle size={11} className="mr-1 inline text-red-400" />}
            บิล {billFiles.length} ไฟล์
          </span>
          <span className="text-slate-400">สลิป {slipFiles.length} ไฟล์</span>
          <span className="text-slate-400">รูปรับของ {goodsReceiptFiles.length} ไฟล์</span>
        </div>
      </div>

      {errorMessage && (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3">
          <AlertTriangle size={14} className="text-red-500" />
          <p className="text-sm text-red-700">{errorMessage}</p>
        </div>
      )}

      <div className="flex justify-end gap-3">
        <button
          type="button"
          onClick={() => setIsOpen(false)}
          className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50"
        >
          ยกเลิก
        </button>
        <button
          type="submit"
          disabled={isSubmitting}
          className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-blue-700 disabled:opacity-60"
        >
          {isSubmitting ? "กำลังส่ง..." : "ส่งหลักฐาน"}
        </button>
      </div>
    </form>
  );
}
