"use client";
import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import {
  ArrowLeft, Plus, Trash2, Paperclip, FileText,
  ImageIcon, X as XIcon, ExternalLink,
} from "lucide-react";
import { CompanySelector, getBranchBorderColor } from "@/components/shared/CompanySelector";
import { DateTimePicker } from "@/components/shared/DateTimePicker";
import type { Branch } from "@/types/database";

// ── Types ─────────────────────────────────────────────────────────────────────

interface EditItem {
  description: string;
  unit: string;
  quantity: number;
  unit_price: number;
  product_id: string;
}

interface ExistingAttachment {
  id: string;
  file_name: string;
  file_url: string;
  file_type: "image" | "pdf";
  file_size: number | null;
}

interface PREditFormProps {
  prStatus: "draft" | "returned";
  pr: {
    id: string;
    pr_number: string;
    title: string;
    note: string | null;
    is_urgent: boolean;
    needed_by: string | null;
    branch_id: string;
    bank_name: string | null;
    bank_account_number: string | null;
  };
  prItems: {
    id: string;
    description: string;
    quantity: number;
    unit: string;
    unit_price: number;
    product_id: string | null;
  }[];
  attachments: ExistingAttachment[];
  branches: Branch[];
  products: { id: string; name: string; sku: string; unit: string; unit_price: number }[];
  currentUserId: string;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function PREditForm({
  prStatus,
  pr,
  prItems,
  attachments,
  branches,
  products,
  currentUserId,
}: PREditFormProps) {
  const router = useRouter();
  const supabase = createClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // ── Form fields ─────────────────────────────────────────────────────────────
  const [title, setTitle] = useState(pr.title);
  const [note, setNote] = useState(pr.note ?? "");
  const [isUrgent, setIsUrgent] = useState(pr.is_urgent);
  const [neededBy, setNeededBy] = useState(pr.needed_by ?? new Date().toISOString());
  const [branchId, setBranchId] = useState(pr.branch_id);

  // ── Items ───────────────────────────────────────────────────────────────────
  const [rawInputs, setRawInputs] = useState<Record<string, string>>({});
  const [items, setItems] = useState<EditItem[]>(() =>
    prItems.map(it => ({
      description: it.description,
      unit: it.unit,
      quantity: Number(it.quantity),
      unit_price: Number(it.unit_price),
      product_id: it.product_id ?? "",
    }))
  );

  // ── Attachments ─────────────────────────────────────────────────────────────
  const [existingAttachments, setExistingAttachments] = useState<ExistingAttachment[]>(attachments);
  // เก็บทั้ง id และ file_url เพื่อใช้ลบออกจาก Storage ด้วย
  const [deletedAttachments, setDeletedAttachments] = useState<{ id: string; file_url: string }[]>([]);
  const [newFiles, setNewFiles] = useState<File[]>([]);

  // ── Derived ─────────────────────────────────────────────────────────────────
  const selectedBranch = branches.find(b => b.id === branchId);
  const borderColor = getBranchBorderColor(selectedBranch?.code);
  const totalAmount = items.reduce((s, it) => s + it.quantity * it.unit_price, 0);

  // ── Item handlers ───────────────────────────────────────────────────────────
  function addItem() {
    setItems(p => [...p, { description: "", unit: "", quantity: 1, unit_price: 0, product_id: "" }]);
  }
  function removeItem(i: number) {
    setItems(p => p.filter((_, idx) => idx !== i));
  }
  function updateItem(i: number, field: keyof EditItem, value: string | number) {
    setItems(p => p.map((it, idx) => idx !== i ? it : { ...it, [field]: value }));
  }
  function applyProduct(i: number, productId: string) {
    setItems(p =>
      p.map((it, idx) => {
        if (idx !== i) return it;
        if (!productId) return { ...it, product_id: "", unit: "", unit_price: 0 };
        const prod = products.find(p => p.id === productId);
        if (!prod) return it;
        return { ...it, product_id: productId, unit: prod.unit, unit_price: prod.unit_price };
      })
    );
  }

  // ── Attachment handlers ─────────────────────────────────────────────────────
  function removeExisting(att: ExistingAttachment) {
    setDeletedAttachments(prev => [...prev, { id: att.id, file_url: att.file_url }]);
    setExistingAttachments(prev => prev.filter(a => a.id !== att.id));
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(e.target.files ?? []);
    setNewFiles(prev => {
      const existing = new Set(prev.map(f => f.name + f.size));
      return [...prev, ...selected.filter(f => !existing.has(f.name + f.size))];
    });
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function removeNewFile(i: number) {
    setNewFiles(prev => prev.filter((_, idx) => idx !== i));
  }

  function formatFileSize(bytes: number) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  // ── Submit ──────────────────────────────────────────────────────────────────
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) { setErrorMessage("กรุณาระบุชื่อ/เรื่อง"); return; }
    if (items.length === 0) { setErrorMessage("กรุณาเพิ่มรายการสินค้าอย่างน้อย 1 รายการ"); return; }
    if (items.some(it => !it.description.trim())) {
      setErrorMessage("กรุณากรอกรายละเอียดสินค้าให้ครบทุกรายการ");
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      // 1. ลบ attachment ที่ถูก mark ว่าจะลบ (ลบทั้ง DB record และ Storage file)
      for (const { id: attId, file_url } of deletedAttachments) {
        await (supabase as any).from("pr_attachments").delete().eq("id", attId);
        // แยก storage path จาก public URL เพื่อลบไฟล์จริงออกจาก bucket
        const storageMarker = "/object/public/pr-attachments/";
        const markerIdx = file_url.indexOf(storageMarker);
        if (markerIdx !== -1) {
          const storagePath = file_url.slice(markerIdx + storageMarker.length);
          await supabase.storage.from("pr-attachments").remove([storagePath]);
        }
      }

      // 2. Upload ไฟล์ใหม่
      for (const file of newFiles) {
        const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
        const path = `${pr.id}/${Date.now()}_${safeName}`;
        const { error: uploadErr } = await supabase.storage
          .from("pr-attachments")
          .upload(path, file, { upsert: false });
        if (uploadErr) throw new Error(`อัปโหลด "${file.name}" ไม่สำเร็จ: ${uploadErr.message}`);
        const { data: { publicUrl } } = supabase.storage
          .from("pr-attachments")
          .getPublicUrl(path);
        await (supabase as any).from("pr_attachments").insert({
          pr_id: pr.id,
          file_name: file.name,
          file_url: publicUrl,
          file_type: file.type.startsWith("image/") ? "image" : "pdf",
          file_size: file.size,
          uploaded_by: currentUserId,
        });
      }

      // 3. ลบรายการสินค้าเดิมทั้งหมด แล้ว insert ใหม่
      await supabase.from("pr_items").delete().eq("pr_id", pr.id);
      const { error: itemsInsertError } = await supabase.from("pr_items").insert(
        items.map((it, i) => ({
          pr_id: pr.id,
          line_no: i + 1,
          product_id: it.product_id || null,
          description: it.description.trim(),
          quantity: it.quantity,
          unit: it.unit || "ชิ้น",
          unit_price: it.unit_price,
          // line_total เป็น generated column — ห้าม include ใน INSERT
        }))
      );
      if (itemsInsertError) throw itemsInsertError;

      // 4. Update PR header — draft บันทึกเป็น draft, returned ส่งใหม่เป็น submitted
      const now = new Date().toISOString();
      const statusUpdate = prStatus === "returned"
        ? { status: "submitted", rejected_at: null, rejected_by: null, rejection_reason: null, submitted_at: now, submitted_by: currentUserId }
        : { status: "draft" };

      const { error: prError } = await (supabase as any)
        .from("purchase_requisitions")
        .update({
          title: title.trim(),
          note: note.trim() || null,
          is_urgent: isUrgent,
          needed_by: neededBy || null,
          branch_id: branchId,
          total_amount: totalAmount,
          ...statusUpdate,
        })
        .eq("id", pr.id);

      if (prError) throw prError;

      router.push(`/requisitions/${pr.id}`);
      router.refresh();
    } catch (err: unknown) {
      setErrorMessage((err as Error).message ?? "เกิดข้อผิดพลาด");
      setIsSubmitting(false);
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <form onSubmit={handleSubmit} className="space-y-5">

      {/* ── ข้อมูลหลัก ────────────────────────────────────────────────────── */}
      <div className={`space-y-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm border-l-4 ${borderColor} transition-colors`}>

        {/* บริษัท */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs text-slate-500 mb-1">เลขที่ PR</p>
            <p className="font-mono text-sm font-bold text-slate-700">{pr.pr_number}</p>
          </div>
          {branches.length > 0 && (
            <CompanySelector
              branches={branches}
              selectedId={branchId}
              onChange={(id) => setBranchId(id)}
            />
          )}
        </div>

        {/* ชื่อเรื่อง */}
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">
            ชื่อ/เรื่อง <span className="text-red-500">*</span>
          </label>
          <input
            value={title}
            onChange={e => setTitle(e.target.value)}
            required
            placeholder="เช่น ขอซื้อกระดาษ A4 ประจำไตรมาส Q3"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
          />
        </div>

        {/* ด่วน */}
        <div className="flex items-center justify-between rounded-lg border border-slate-200 px-4 py-3">
          <div>
            <p className="text-sm font-medium text-slate-700">งานด่วน</p>
            <p className="text-xs text-slate-400">ข้ามขั้นตอนอนุมัติรอบ 2 เมื่อยอดจริงเกินงบ</p>
          </div>
          <button
            type="button"
            onClick={() => setIsUrgent(v => !v)}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${isUrgent ? "bg-red-500" : "bg-slate-200"}`}
          >
            <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${isUrgent ? "translate-x-6" : "translate-x-1"}`} />
          </button>
        </div>

        {/* วันที่ต้องการ */}
        <div>
          <DateTimePicker label="วันที่ต้องการ" value={neededBy} onChange={setNeededBy} />
        </div>

        {/* หมายเหตุ */}
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">หมายเหตุ</label>
          <textarea
            value={note}
            onChange={e => setNote(e.target.value)}
            rows={2}
            placeholder="รายละเอียดเพิ่มเติม"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
          />
        </div>
      </div>

      {/* ── รายการสินค้า ─────────────────────────────────────────────────── */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <h2 className="font-semibold text-slate-700">รายการสินค้า / บริการ</h2>
          <button
            type="button"
            onClick={addItem}
            className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800"
          >
            <Plus size={15} /> เพิ่มรายการ
          </button>
        </div>

        <div className="divide-y divide-slate-100">
          {items.map((item, index) => (
            <div key={index} className="px-5 py-4 space-y-2">
              <div className="flex items-center gap-2">
                <span className="w-5 shrink-0 text-xs font-medium text-slate-400">{index + 1}.</span>
                <input
                  value={item.description}
                  onChange={e => updateItem(index, "description", e.target.value)}
                  placeholder="รายละเอียดสินค้า / บริการ *"
                  className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                />
                {items.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeItem(index)}
                    className="shrink-0 rounded p-1.5 text-slate-300 transition-colors hover:bg-red-50 hover:text-red-500"
                  >
                    <Trash2 size={15} />
                  </button>
                )}
              </div>

              <div className="ml-7 flex flex-wrap items-center gap-2 text-sm">
                <select
                  value={item.product_id}
                  onChange={e => applyProduct(index, e.target.value)}
                  className="rounded border border-slate-200 bg-slate-50 px-2 py-1.5 text-xs text-slate-600 focus:border-blue-400 focus:outline-none"
                >
                  <option value="">— ระบุเอง —</option>
                  {products.map(p => (
                    <option key={p.id} value={p.id}>[{p.sku}] {p.name}</option>
                  ))}
                </select>

                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-slate-400">จำนวน</span>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={rawInputs[`${index}_q`] ?? String(item.quantity || "")}
                    onChange={e => {
                      setRawInputs(p => ({ ...p, [`${index}_q`]: e.target.value }));
                      updateItem(index, "quantity", parseFloat(e.target.value) || 0);
                    }}
                    className="w-20 rounded border border-slate-300 px-2 py-1.5 text-right text-sm focus:border-blue-500 focus:outline-none"
                  />
                </div>

                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-slate-400">หน่วย</span>
                  <input
                    value={item.unit}
                    onChange={e => updateItem(index, "unit", e.target.value)}
                    placeholder="ชิ้น"
                    className="w-16 rounded border border-slate-300 px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
                  />
                </div>

                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-slate-400">ราคา/หน่วย</span>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={rawInputs[`${index}_p`] ?? String(item.unit_price)}
                    onChange={e => {
                      setRawInputs(p => ({ ...p, [`${index}_p`]: e.target.value }));
                      updateItem(index, "unit_price", parseFloat(e.target.value) || 0);
                    }}
                    className="w-28 rounded border border-slate-300 px-2 py-1.5 text-right text-sm focus:border-blue-500 focus:outline-none"
                  />
                </div>

                <div className="ml-auto flex items-center gap-1.5">
                  <span className="text-xs text-slate-400">รวม</span>
                  <span className="min-w-[80px] text-right font-semibold text-slate-800">
                    ฿{(item.quantity * item.unit_price).toLocaleString("th-TH", { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-slate-200 bg-slate-50 px-6 py-3">
          <span className="text-sm font-semibold text-slate-700">รวมทั้งสิ้น</span>
          <span className="text-lg font-bold text-blue-700">
            ฿{totalAmount.toLocaleString("th-TH", { minimumFractionDigits: 2 })}
          </span>
        </div>
      </div>

      {/* ── ใบเสนอราคา ───────────────────────────────────────────────────── */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="mb-1 font-semibold text-slate-700">ใบเสนอราคา</h2>
        <p className="mb-4 text-xs text-slate-400">แนบใบเสนอราคาจากผู้ขาย (ถ้ามี)</p>

        {/* ไฟล์เดิม — แสดงเสมอ ไม่ว่าจะมีไฟล์หรือไม่ */}
        <div className="mb-4">
          <p className="mb-2 text-xs font-medium text-slate-500 uppercase tracking-wide">
            ใบเสนอราคาที่แนบไว้แล้ว ({existingAttachments.length})
          </p>
          {existingAttachments.length === 0 ? (
            <p className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-4 py-3 text-center text-xs text-slate-400">
              ยังไม่มีไฟล์แนบเดิม
            </p>
          ) : (
            <ul className="space-y-2">
              {existingAttachments.map(att => (
                <li
                  key={att.id}
                  className="flex items-center gap-3 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2"
                >
                  {att.file_type === "image" ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={att.file_url}
                      alt={att.file_name}
                      className="h-10 w-10 shrink-0 rounded-md object-cover border border-slate-200"
                    />
                  ) : (
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-red-50">
                      <FileText size={18} className="text-red-400" />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-slate-700">{att.file_name}</p>
                    {att.file_size && (
                      <p className="text-xs text-slate-400">{formatFileSize(att.file_size)}</p>
                    )}
                  </div>
                  <a
                    href={att.file_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="shrink-0 rounded p-1.5 text-slate-400 hover:text-blue-500 transition-colors"
                    title="เปิดไฟล์"
                  >
                    <ExternalLink size={14} />
                  </a>
                  <button
                    type="button"
                    onClick={() => removeExisting(att)}
                    className="shrink-0 rounded p-1.5 text-slate-300 hover:bg-red-50 hover:text-red-500 transition-colors"
                    title="ลบไฟล์นี้"
                  >
                    <XIcon size={14} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* เพิ่มไฟล์ใหม่ */}
        <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center transition-colors hover:border-blue-400 hover:bg-blue-50">
          <Paperclip size={22} className="text-slate-400" />
          <p className="text-sm font-medium text-slate-600">คลิกเพื่อแนบใบเสนอราคา</p>
          <p className="text-xs text-slate-400">รองรับ JPG, PNG, WEBP, PDF — หลายไฟล์ได้</p>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/jpeg,image/png,image/webp,application/pdf"
            onChange={handleFileChange}
            className="hidden"
          />
        </label>

        {/* Preview ไฟล์ใหม่ที่เลือก */}
        {newFiles.length > 0 && (
          <ul className="mt-4 space-y-2">
            {newFiles.map((file, i) => {
              const isImage = file.type.startsWith("image/");
              const previewUrl = isImage ? URL.createObjectURL(file) : null;
              return (
                <li key={i} className="flex items-center gap-3 rounded-lg border border-blue-100 bg-blue-50 px-3 py-2">
                  {previewUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={previewUrl}
                      alt={file.name}
                      className="h-10 w-10 shrink-0 rounded-md object-cover border border-slate-200"
                    />
                  ) : (
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-red-50">
                      <FileText size={18} className="text-red-400" />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-slate-700">{file.name}</p>
                    <p className="text-xs text-slate-400">
                      {isImage ? <ImageIcon size={10} className="mr-1 inline" /> : <FileText size={10} className="mr-1 inline" />}
                      {formatFileSize(file.size)} · ใหม่
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeNewFile(i)}
                    className="shrink-0 rounded p-1 text-slate-300 hover:bg-red-50 hover:text-red-500 transition-colors"
                  >
                    <XIcon size={14} />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* ── Error ─────────────────────────────────────────────────────────── */}
      {errorMessage && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{errorMessage}</p>
      )}

      {/* ── Actions ───────────────────────────────────────────────────────── */}
      <div className="flex justify-end gap-3">
        <Link
          href={`/requisitions/${pr.id}`}
          className="flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50"
        >
          <ArrowLeft size={15} /> ยกเลิก
        </Link>
        <button
          type="submit"
          disabled={isSubmitting}
          className={`rounded-lg px-5 py-2 text-sm font-medium text-white shadow-sm transition disabled:opacity-60 ${
            prStatus === "returned"
              ? "bg-orange-500 hover:bg-orange-600"
              : "bg-blue-600 hover:bg-blue-700"
          }`}
        >
          {isSubmitting
            ? "กำลังบันทึก..."
            : prStatus === "returned"
            ? "ส่งขออนุมัติใหม่"
            : "บันทึกการแก้ไข"}
        </button>
      </div>
    </form>
  );
}
