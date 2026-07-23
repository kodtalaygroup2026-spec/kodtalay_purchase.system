"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { FileUploadZone, type PreviousFile } from "./EvidenceSubmissionSection";
import { logAudit } from "@/lib/supabase/audit";
import { formatCurrency, formatDate } from "@/lib/utils/format";
import {
  ArrowLeft, FileText, ImageIcon, Package,
  CheckCircle2, Loader2, AlertTriangle, X,
} from "lucide-react";

interface Props {
  pr: {
    id: string;
    pr_number: string;
    title: string;
    amount: number;
    paid_at: string | null;
  };
  evidenceId: string;
  /** สิ่งที่ฝ่ายบัญชีแจ้งว่าต้องแก้ */
  reviewNote: string | null;
  /** ไฟล์หลักฐานเดิม (เฉพาะ bill/slip/goods_receipt — ไม่รวมสลิปที่ บช. แนบ) */
  previousFiles: PreviousFile[];
  currentUserId: string;
}

/**
 * หน้าแก้ไข "เฉพาะส่วนส่งหลักฐาน" ของใบที่จ่ายแล้วแต่เอกสารไม่ครบ
 * ใช้ FileUploadZone ตัวเดียวกับตอนส่งหลักฐานครั้งแรก เพื่อให้หน้าตา/วิธีใช้เหมือนกัน
 * ส่วนอื่นของใบ (ยอดเงิน ผู้รับเงิน ช่องทางจ่าย) แก้ไม่ได้ — จ่ายเงินไปแล้ว
 */
export function EvidenceFixForm({ pr, evidenceId, reviewNote, previousFiles, currentUserId }: Props) {
  const router = useRouter();
  const supabase = createClient();

  const [billFiles, setBillFiles] = useState<File[]>([]);
  const [slipFiles, setSlipFiles] = useState<File[]>([]);
  const [goodsFiles, setGoodsFiles] = useState<File[]>([]);
  const [keptPrev, setKeptPrev] = useState<PreviousFile[]>(previousFiles);
  const [removedIds, setRemovedIds] = useState<string[]>([]);
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  const prevBills = keptPrev.filter((f) => f.evidence_type === "bill");
  const prevSlips = keptPrev.filter((f) => f.evidence_type === "slip");
  const prevGoods = keptPrev.filter((f) => f.evidence_type === "goods_receipt");

  const addFiles = (setter: React.Dispatch<React.SetStateAction<File[]>>) => (files: File[]) =>
    setter((prev) => [...prev, ...files]);
  const removeFile = (setter: React.Dispatch<React.SetStateAction<File[]>>) => (index: number) =>
    setter((prev) => prev.filter((_, i) => i !== index));

  function removePrevFile(id: string) {
    setKeptPrev((prev) => prev.filter((f) => f.id !== id));
    setRemovedIds((prev) => [...prev, id]);
  }

  const newFileCount = billFiles.length + slipFiles.length + goodsFiles.length;
  const totalFileCount = newFileCount + keptPrev.length;
  const hasChanges = newFileCount > 0 || removedIds.length > 0 || note.trim().length > 0;

  async function uploadFiles(files: File[], evidenceType: "bill" | "slip" | "goods_receipt") {
    for (const file of files) {
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const path = `${evidenceId}/fix_${Date.now()}_${safeName}`;
      const { error: upErr } = await supabase.storage
        .from("evidence-attachments")
        .upload(path, file, { upsert: false });
      if (upErr) throw new Error(upErr.message);
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

  async function handleSubmit() {
    if (totalFileCount === 0) {
      setErrorMessage("ต้องมีไฟล์หลักฐานอย่างน้อย 1 ไฟล์");
      return;
    }
    if (!hasChanges) {
      setErrorMessage("ยังไม่มีการแก้ไข — เพิ่ม/ลบไฟล์ หรือกรอกคำอธิบายก่อนส่ง");
      return;
    }
    setSubmitting(true);
    setErrorMessage(null);
    try {
      // 1) อัปโหลดไฟล์ใหม่แยกตามประเภท
      if (billFiles.length > 0) await uploadFiles(billFiles, "bill");
      if (slipFiles.length > 0) await uploadFiles(slipFiles, "slip");
      if (goodsFiles.length > 0) await uploadFiles(goodsFiles, "goods_receipt");

      // 2) ลบไฟล์เดิมที่เอาออก (ลบเฉพาะแถวใน DB — object ใน storage ปล่อย orphan ได้)
      const removedNames = previousFiles.filter((f) => removedIds.includes(f.id)).map((f) => f.file_name);
      if (removedIds.length > 0) {
        await (supabase as any).from("evidence_files").delete().in("id", removedIds);
      }

      // 3) ส่งเข้าคิวตรวจของ บช. → close_status = fixed
      const trimmedNote = note.trim();
      const { data, error } = await (supabase as any)
        .from("payment_evidences")
        .update({
          close_status: "fixed",
          fix_note: trimmedNote || null,
          fixed_at: new Date().toISOString(),
        })
        .eq("id", evidenceId)
        .eq("close_status", "incomplete")
        .select("id");
      if (error) throw error;
      if (!data || data.length === 0) throw new Error("รายการถูกดำเนินการไปแล้ว กรุณารีเฟรช");

      // 4) บันทึกลงประวัติการแก้ไข
      logAudit({
        actorId: currentUserId,
        action: "documents_fixed",
        entity: "purchase_requisitions",
        entityId: pr.id,
        metadata: {
          pr_id: pr.id,
          pr_number: pr.pr_number,
          ...(trimmedNote ? { note: trimmedNote } : {}),
          ...(newFileCount ? { added_files: newFileCount } : {}),
          ...(removedIds.length ? { removed_files: removedIds.length, removed_file_names: removedNames } : {}),
        },
      });

      router.push("/requisitions/incomplete");
      router.refresh();
    } catch (err: any) {
      setErrorMessage(err?.message ?? "เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง");
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      {/* ── หัวเรื่อง ── */}
      <div className="flex items-center gap-3">
        <Link href="/requisitions/incomplete" className="text-slate-400 hover:text-slate-600">
          <ArrowLeft size={20} />
        </Link>
        <div className="min-w-0">
          <h1 className="text-xl font-bold text-slate-800">แก้ไขเอกสารหลักฐาน</h1>
          <p className="truncate text-sm text-slate-500">
            <span className="font-mono">{pr.pr_number}</span> · {pr.title}
          </p>
        </div>
      </div>

      {/* ── สรุปใบ (อ่านอย่างเดียว) ── */}
      <div className="rounded-xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
        <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm">
          <div>
            <p className="text-xs text-slate-400">ยอดที่จ่ายแล้ว</p>
            <p className="font-semibold text-slate-800">{formatCurrency(pr.amount)}</p>
          </div>
          <div>
            <p className="text-xs text-slate-400">วันที่จ่าย</p>
            <p className="font-medium text-slate-700">{pr.paid_at ? formatDate(pr.paid_at) : "—"}</p>
          </div>
        </div>
        <p className="mt-3 border-t border-slate-100 pt-3 text-xs text-slate-400">
          จ่ายเงินไปแล้ว — แก้ไขได้เฉพาะไฟล์หลักฐานเท่านั้น ยอดเงินและข้อมูลผู้รับเงินแก้ไม่ได้
        </p>
      </div>

      {/* ── สิ่งที่ บช. แจ้งว่าต้องแก้ ── */}
      {reviewNote && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-5 py-4">
          <AlertTriangle size={16} className="mt-0.5 shrink-0 text-amber-500" />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-amber-800">ฝ่ายบัญชีแจ้งว่าต้องแก้</p>
            <p className="mt-0.5 whitespace-pre-line text-xs text-amber-700">{reviewNote}</p>
          </div>
        </div>
      )}

      {/* ── ไฟล์หลักฐาน ── */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="mb-1 text-sm font-semibold text-slate-700">ไฟล์หลักฐาน</h3>
        <p className="mb-3 text-xs text-slate-400">
          ลบไฟล์ที่ผิด/ไม่ชัดออก แล้วแนบไฟล์ใหม่ให้ครบตามที่ฝ่ายบัญชีแจ้ง
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
            icon={FileText}
            accentColor="text-orange-500"
          />
          <FileUploadZone
            label="สลิปการโอนเงิน"
            description="หลักฐานการชำระเงิน (ถ้ามี)"
            files={slipFiles}
            onAdd={addFiles(setSlipFiles)}
            onRemove={removeFile(setSlipFiles)}
            existing={prevSlips}
            onRemoveExisting={removePrevFile}
            onPreview={setLightboxUrl}
            icon={ImageIcon}
            accentColor="text-blue-500"
          />
          <FileUploadZone
            label="รูปถ่ายการรับของ"
            description="ภาพถ่ายสินค้าที่รับมาจริง"
            files={goodsFiles}
            onAdd={addFiles(setGoodsFiles)}
            onRemove={removeFile(setGoodsFiles)}
            existing={prevGoods}
            onRemoveExisting={removePrevFile}
            onPreview={setLightboxUrl}
            icon={Package}
            accentColor="text-green-500"
          />
        </div>
      </div>

      {/* ── คำอธิบายการแก้ ── */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <label className="mb-2 block text-sm font-semibold text-slate-700">
          อธิบายสิ่งที่แก้ <span className="text-xs font-normal text-slate-400">(บันทึกลงประวัติการแก้ไข)</span>
        </label>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={3}
          placeholder="เช่น แนบใบกำกับภาษีตัวจริงแล้ว / เปลี่ยนรูปบิลให้ชัดขึ้น"
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm placeholder:text-slate-400 focus:border-blue-500 focus:outline-none"
        />
      </div>

      {/* ── สรุป + ปุ่มส่ง ── */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <p className="mb-3 text-xs text-slate-500">
          ไฟล์ทั้งหมด <span className="font-semibold text-slate-700">{totalFileCount}</span> ไฟล์
          {newFileCount > 0 && <span className="text-green-600"> · เพิ่มใหม่ {newFileCount}</span>}
          {removedIds.length > 0 && <span className="text-red-500"> · ลบออก {removedIds.length}</span>}
        </p>
        {errorMessage && (
          <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">{errorMessage}</p>
        )}
        <div className="flex justify-end gap-2">
          <Link
            href="/requisitions/incomplete"
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50"
          >
            ยกเลิก
          </Link>
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:opacity-60"
          >
            {submitting ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle2 size={15} />}
            ส่งให้ฝ่ายบัญชีตรวจ
          </button>
        </div>
      </div>

      {/* ── ดูรูปเต็ม ── */}
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
