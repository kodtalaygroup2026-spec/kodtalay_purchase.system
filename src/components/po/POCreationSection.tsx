"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  AlertTriangle, CheckCircle2, Paperclip, FileText, ImageIcon,
  X as XIcon, Plus,
} from "lucide-react";

const PRICE_TOLERANCE = 0.10;

interface PRItemForPO {
  id: string;
  line_no: number;
  description: string;
  unit: string;
  quantity: number;
  pr_unit_price: number;
}

export interface POCreationSectionProps {
  prId: string;
  prNumber: string;
  prTitle: string;
  prTotalAmount: number;
  prItems: PRItemForPO[];
  currentUserId: string;
}

interface POItemRow extends PRItemForPO {
  po_unit_price: number;
}

function getVariancePct(poPrice: number, prPrice: number): number {
  if (prPrice === 0) return 0;
  return (poPrice - prPrice) / prPrice;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function todayString(): string {
  return new Date().toISOString().split("T")[0];
}

export function POCreationSection({
  prId, prNumber, prTitle, prTotalAmount, prItems, currentUserId,
}: POCreationSectionProps) {
  const router = useRouter();
  const supabase = createClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isOpen, setIsOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // ── PO fields ──────────────────────────────────────────────────────────────
  const [vendorName, setVendorName] = useState("");
  const [note, setNote] = useState("");
  const [items, setItems] = useState<POItemRow[]>(() =>
    prItems.map(it => ({ ...it, po_unit_price: it.pr_unit_price }))
  );
  const [attachFiles, setAttachFiles] = useState<File[]>([]);

  // ── Bill fields ────────────────────────────────────────────────────────────
  const [billNumber, setBillNumber] = useState("");
  const [billDate, setBillDate] = useState(todayString());

  // ── Derived ────────────────────────────────────────────────────────────────
  const poSubtotal = items.reduce((s, it) => s + it.quantity * it.po_unit_price, 0);
  const vatRate = 7;
  const vatAmount = poSubtotal * vatRate / 100;
  const poTotal = poSubtotal + vatAmount;

  const itemsWithVariance = items.map(it => ({
    ...it,
    variancePct: getVariancePct(it.po_unit_price, it.pr_unit_price),
    lineTotal: it.quantity * it.po_unit_price,
  }));
  const hasItemOverBudget = itemsWithVariance.some(it => it.variancePct > PRICE_TOLERANCE);
  const isTotalOverBudget = prTotalAmount > 0 && poTotal > prTotalAmount * (1 + PRICE_TOLERANCE);
  const isOverBudget = hasItemOverBudget || isTotalOverBudget;

  function updatePoPrice(index: number, value: number) {
    setItems(prev => prev.map((it, i) => i !== index ? it : { ...it, po_unit_price: value }));
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(e.target.files ?? []);
    setAttachFiles(prev => {
      const existing = new Set(prev.map(f => f.name + f.size));
      return [...prev, ...selected.filter(f => !existing.has(f.name + f.size))];
    });
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function removeFile(index: number) {
    setAttachFiles(prev => prev.filter((_, i) => i !== index));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMessage(null);
    if (items.length === 0) { setErrorMessage("ไม่มีรายการสินค้าจาก PR"); return; }

    setIsSubmitting(true);

    // ── 1. Generate PO number ──────────────────────────────────────────────
    const { data: poNumber, error: rpcError } = await supabase.rpc("next_document_number", {
      prefix: "PO",
      table_name: "purchase_orders",
      column_name: "po_number",
    });
    if (rpcError) { setErrorMessage(rpcError.message); setIsSubmitting(false); return; }

    const now = new Date().toISOString();

    // ── 2. สร้าง PO → auto-submit ทันที (ไม่ผ่าน draft) ──────────────────
    const { data: po, error: poError } = await (supabase as any)
      .from("purchase_orders")
      .insert({
        po_number: poNumber,
        pr_id: prId,
        pr_total_amount: prTotalAmount,
        vendor_name: vendorName.trim() || null,
        status: "pending_approval",   // ส่งขออนุมัติทันที ไม่ต้องผ่านขั้น draft
        submitted_at: now,
        submitted_by: currentUserId,
        created_by: currentUserId,
        order_date: now.split("T")[0],
        note: note.trim() || null,
        subtotal: poSubtotal,
        vat_rate: vatRate,
        vat_amount: vatAmount,
        total_amount: poTotal,
      })
      .select("id")
      .single();

    if (poError || !po) {
      setErrorMessage(poError?.message ?? "เกิดข้อผิดพลาด");
      setIsSubmitting(false);
      return;
    }

    // ── 3. บันทึกรายการ PO items ──────────────────────────────────────────
    const poItemsData = items.map((it, idx) => ({
      po_id: po.id,
      pr_item_id: it.id,
      pr_unit_price: it.pr_unit_price,
      line_no: idx + 1,
      description: it.description,
      quantity: it.quantity,
      unit: it.unit,
      unit_price: it.po_unit_price,
    }));
    const { error: itemsError } = await supabase.from("po_items").insert(poItemsData);
    if (itemsError) { setErrorMessage(itemsError.message); setIsSubmitting(false); return; }

    // ── 4. บันทึกบิลแยกต่างหากใน purchase_bills ──────────────────────────
    await (supabase as any).from("purchase_bills").insert({
      po_id: po.id,
      bill_number: billNumber.trim() || null,
      bill_date: billDate || todayString(),
      bill_amount: poTotal,
      vendor_name: vendorName.trim() || null,
      notes: note.trim() || null,
      created_by: currentUserId,
    });

    // ── 5. อัปโหลดไฟล์บิล/ใบเสร็จ ────────────────────────────────────────
    for (const file of attachFiles) {
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const path = `${po.id}/${Date.now()}_${safeName}`;
      const { error: uploadErr } = await supabase.storage
        .from("po-attachments")
        .upload(path, file, { upsert: false });
      if (!uploadErr) {
        const { data: { publicUrl } } = supabase.storage.from("po-attachments").getPublicUrl(path);
        await (supabase as any).from("po_attachments").insert({
          po_id: po.id,
          file_name: file.name,
          file_url: publicUrl,
          file_type: file.type.startsWith("image/") ? "image" : "pdf",
          file_size: file.size,
          uploaded_by: currentUserId,
        });
      }
    }

    router.refresh();
  }

  // ── Collapsed: show CTA ────────────────────────────────────────────────────
  if (!isOpen) {
    return (
      <div className="rounded-xl border-2 border-dashed border-green-300 bg-green-50 px-6 py-8 text-center">
        <p className="mb-1 font-semibold text-green-800">PR อนุมัติแล้ว — พร้อมออกใบสั่งซื้อ</p>
        <p className="mb-4 text-sm text-green-600">
          งบประมาณ PR: ฿{prTotalAmount.toLocaleString("th-TH")}
        </p>
        <button
          onClick={() => setIsOpen(true)}
          className="inline-flex items-center gap-2 rounded-lg bg-green-600 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-green-700"
        >
          <Plus size={16} /> สร้างใบสั่งซื้อ (PO)
        </button>
      </div>
    );
  }

  // ── Expanded: full form ────────────────────────────────────────────────────
  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* PR context banner */}
      <div className="rounded-xl border border-blue-200 bg-blue-50 px-5 py-3">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-blue-400 mb-0.5">
          สร้าง PO จาก PR
        </p>
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs font-bold text-blue-700 bg-blue-100 px-2 py-0.5 rounded">
            {prNumber}
          </span>
          <span className="text-sm font-semibold text-blue-800">{prTitle}</span>
        </div>
        <p className="text-xs text-blue-500 mt-0.5">
          งบประมาณ PR: ฿{prTotalAmount.toLocaleString("th-TH")}
        </p>
      </div>

      {/* ร้านค้า */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <label className="mb-1 block text-sm font-medium text-slate-700">
          ร้านค้า / ผู้จำหน่าย
        </label>
        <input
          type="text"
          value={vendorName}
          onChange={e => setVendorName(e.target.value)}
          placeholder="ชื่อร้าน หรือบริษัทที่ซื้อมา"
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
        />
      </div>

      {/* ตารางราคา PR vs PO */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-5 py-4">
          <h2 className="font-semibold text-slate-700">ราคาสินค้าที่ได้มา vs ราคา PR</h2>
          <p className="mt-0.5 text-xs text-slate-400">
            กรอกราคาที่ซื้อจริง — ห้ามเกินราคา PR เกิน 10%
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="border-b border-slate-100 bg-slate-50">
              <tr>
                <th className="px-3 py-2 text-left font-medium text-slate-500 w-8">#</th>
                <th className="px-3 py-2 text-left font-medium text-slate-500">รายการ</th>
                <th className="px-3 py-2 text-right font-medium text-slate-500">จำนวน</th>
                <th className="px-3 py-2 text-right font-medium text-slate-400">ราคา PR</th>
                <th className="px-3 py-2 text-right font-medium text-blue-600">ราคาที่ได้</th>
                <th className="px-3 py-2 text-right font-medium text-slate-500">ต่าง%</th>
                <th className="px-3 py-2 text-right font-medium text-slate-500">รวม</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {itemsWithVariance.map((item, idx) => {
                const isOver = item.variancePct > PRICE_TOLERANCE;
                return (
                  <tr key={item.id} className={isOver ? "bg-red-50" : undefined}>
                    <td className="px-3 py-2.5 text-slate-400">{item.line_no}</td>
                    <td className="px-3 py-2.5 font-medium text-slate-800">{item.description}</td>
                    <td className="px-3 py-2.5 text-right text-slate-600">
                      {Number(item.quantity).toLocaleString("th-TH")} {item.unit}
                    </td>
                    <td className="px-3 py-2.5 text-right text-slate-400">
                      ฿{item.pr_unit_price.toLocaleString("th-TH", { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <input
                        type="number" min="0" step="0.01"
                        value={item.po_unit_price}
                        onChange={e => updatePoPrice(idx, parseFloat(e.target.value) || 0)}
                        className={`w-24 rounded border px-2 py-1 text-right text-sm focus:outline-none ${
                          isOver
                            ? "border-red-400 bg-red-50 text-red-700 focus:border-red-500"
                            : "border-blue-300 bg-blue-50 text-blue-900 focus:border-blue-500"
                        }`}
                      />
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <span className={`text-xs font-semibold ${isOver ? "text-red-600" : "text-green-600"}`}>
                        {isOver && <AlertTriangle size={11} className="mr-0.5 inline" />}
                        {item.variancePct >= 0 ? "+" : ""}
                        {(item.variancePct * 100).toFixed(1)}%
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-right font-medium text-slate-800">
                      ฿{item.lineTotal.toLocaleString("th-TH", { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot className="border-t border-slate-200 bg-slate-50 text-sm">
              <tr>
                <td colSpan={5} />
                <td className="px-3 py-2 text-right text-xs font-medium text-slate-500">ก่อน VAT</td>
                <td className="px-3 py-2 text-right font-semibold text-slate-800">
                  ฿{poSubtotal.toLocaleString("th-TH", { minimumFractionDigits: 2 })}
                </td>
              </tr>
              <tr>
                <td colSpan={5} />
                <td className="px-3 py-1 text-right text-xs text-slate-400">VAT {vatRate}%</td>
                <td className="px-3 py-1 text-right text-xs text-slate-500">
                  ฿{vatAmount.toLocaleString("th-TH", { minimumFractionDigits: 2 })}
                </td>
              </tr>
              <tr className="border-t border-slate-200">
                <td colSpan={5} />
                <td className="px-3 py-2 text-right font-semibold text-slate-700">รวมทั้งสิ้น</td>
                <td className="px-3 py-2 text-right font-bold text-slate-900">
                  ฿{poTotal.toLocaleString("th-TH", { minimumFractionDigits: 2 })}
                </td>
              </tr>
              {prTotalAmount > 0 && (
                <tr className="border-t border-slate-100 bg-blue-50">
                  <td colSpan={5} />
                  <td className="px-3 py-1.5 text-right text-xs text-slate-400">งบ PR (อ้างอิง)</td>
                  <td className={`px-3 py-1.5 text-right text-xs font-semibold ${
                    isTotalOverBudget ? "text-red-600" : "text-green-600"
                  }`}>
                    ฿{prTotalAmount.toLocaleString("th-TH", { minimumFractionDigits: 2 })}
                    {isTotalOverBudget && <span className="ml-1">⚠ เกินงบ</span>}
                  </td>
                </tr>
              )}
            </tfoot>
          </table>
        </div>
        <div className="px-4 pb-4">
          {isOverBudget ? (
            <div className="flex items-start gap-2 rounded-lg border border-orange-200 bg-orange-50 px-4 py-3">
              <AlertTriangle size={14} className="mt-0.5 shrink-0 text-orange-500" />
              <p className="text-sm text-orange-700">
                ราคาเกินงบ PR เกิน 10% — บันทึกได้ แต่ผู้อนุมัติจะเห็นความแตกต่างนี้
              </p>
            </div>
          ) : items.length > 0 ? (
            <div className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-4 py-2.5">
              <CheckCircle2 size={14} className="text-green-600" />
              <p className="text-sm text-green-700">ราคาอยู่ในเกณฑ์ที่กำหนด</p>
            </div>
          ) : null}
        </div>
      </div>

      {/* แนบบิล / ใบเสร็จ */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="mb-1 font-semibold text-slate-700">บันทึกบิล / ใบเสร็จ</h2>
        <p className="mb-4 text-xs text-slate-400">กรอกข้อมูลบิลและแนบไฟล์ — ระบบจะบันทึกไว้ในฐานข้อมูลแยกต่างหาก</p>

        {/* เลขที่บิล + วันที่บิล */}
        <div className="mb-4 grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">เลขที่บิล (ถ้ามี)</label>
            <input
              type="text"
              value={billNumber}
              onChange={e => setBillNumber(e.target.value)}
              placeholder="เช่น INV-2024-001"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">วันที่บิล</label>
            <input
              type="date"
              value={billDate}
              onChange={e => setBillDate(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            />
          </div>
        </div>

        {/* อัปโหลดไฟล์ */}
        <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 py-6 text-center transition-colors hover:border-blue-400 hover:bg-blue-50">
          <Paperclip size={18} className="text-slate-400" />
          <p className="text-sm font-medium text-slate-600">คลิกเพื่อแนบไฟล์บิล/ใบเสร็จ</p>
          <p className="text-xs text-slate-400">JPG, PNG, WEBP, PDF</p>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/jpeg,image/png,image/webp,application/pdf"
            onChange={handleFileChange}
            className="hidden"
          />
        </label>
        {attachFiles.length > 0 && (
          <ul className="mt-3 space-y-2">
            {attachFiles.map((file, i) => {
              const isImage = file.type.startsWith("image/");
              const previewUrl = isImage ? URL.createObjectURL(file) : null;
              return (
                <li key={i} className="flex items-center gap-3 rounded-lg border border-slate-100 bg-white px-3 py-2">
                  {previewUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={previewUrl} alt={file.name}
                      className="h-9 w-9 shrink-0 rounded object-cover border border-slate-200" />
                  ) : (
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded bg-red-50">
                      <FileText size={16} className="text-red-400" />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-slate-700">{file.name}</p>
                    <p className="text-xs text-slate-400">
                      {isImage
                        ? <ImageIcon size={10} className="mr-1 inline" />
                        : <FileText size={10} className="mr-1 inline" />}
                      {formatFileSize(file.size)}
                    </p>
                  </div>
                  <button type="button" onClick={() => removeFile(i)}
                    className="shrink-0 rounded p-1 text-slate-300 hover:bg-red-50 hover:text-red-500 transition-colors">
                    <XIcon size={14} />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* หมายเหตุ */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <label className="mb-2 block font-semibold text-slate-700">หมายเหตุ</label>
        <textarea
          value={note}
          onChange={e => setNote(e.target.value)}
          rows={2}
          placeholder="หมายเหตุเพิ่มเติม (ถ้ามี)"
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
        />
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
          className="rounded-lg bg-green-600 px-5 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-green-700 disabled:opacity-60"
        >
          {isSubmitting ? "กำลังส่ง PO..." : "บันทึกและส่ง PO"}
        </button>
      </div>
    </form>
  );
}
