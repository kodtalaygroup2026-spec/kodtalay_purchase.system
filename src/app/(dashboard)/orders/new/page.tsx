"use client";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import {
  ArrowLeft, AlertTriangle, CheckCircle2,
  Paperclip, FileText, ImageIcon, X as XIcon,
} from "lucide-react";

const PRICE_TOLERANCE = 0.10;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface ApprovedPR {
  id: string;
  pr_number: string;
  title: string;
  total_amount: number;
  requester_name: string;
}

interface PRItemRow {
  id: string;        // pr_item_id
  line_no: number;
  description: string;
  unit: string;
  quantity: number;
  pr_unit_price: number;   // ราคาจาก PR (อ้างอิง, readonly)
  po_unit_price: number;   // ราคาจริงที่ได้มา (editable)
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function getVariancePct(poPrice: number, prPrice: number): number {
  if (prPrice === 0) return 0;
  return (poPrice - prPrice) / prPrice;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export default function NewOrderPage() {
  const router = useRouter();
  const supabase = createClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // ── Data ────────────────────────────────────────────────────────────────
  const [approvedPRs, setApprovedPRs] = useState<ApprovedPR[]>([]);

  // ── Selections ──────────────────────────────────────────────────────────
  const [selectedPrId, setSelectedPrId] = useState("");
  const [selectedPr, setSelectedPr] = useState<ApprovedPR | null>(null);
  const [vendorName, setVendorName] = useState("");
  const [note, setNote] = useState("");

  // ── Items ────────────────────────────────────────────────────────────────
  const [items, setItems] = useState<PRItemRow[]>([]);
  const [loadingItems, setLoadingItems] = useState(false);

  // ── Attachments ──────────────────────────────────────────────────────────
  const [attachFiles, setAttachFiles] = useState<File[]>([]);

  // ── Load approved PRs ────────────────────────────────────────────────────
  useEffect(() => {
    async function loadPRs() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data } = await (supabase as any)
        .from("purchase_requisitions")
        .select("id, pr_number, title, total_amount, profiles!requester_id(full_name)")
        .eq("status", "approved")
        .eq("requester_id", user.id)
        .order("created_at", { ascending: false });

      setApprovedPRs(
        (data ?? []).map((pr: any) => ({
          id: pr.id,
          pr_number: pr.pr_number,
          title: pr.title,
          total_amount: pr.total_amount,
          requester_name: pr.profiles?.full_name ?? "—",
        }))
      );
    }
    loadPRs();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Load items when PR selected ──────────────────────────────────────────
  async function handlePrSelect(prId: string) {
    setSelectedPrId(prId);
    setItems([]);
    if (!prId) { setSelectedPr(null); return; }

    const pr = approvedPRs.find((p) => p.id === prId) ?? null;
    setSelectedPr(pr);

    setLoadingItems(true);
    const { data: prItems } = await supabase
      .from("pr_items")
      .select("id, line_no, description, unit, quantity, unit_price")
      .eq("pr_id", prId)
      .order("line_no");

    setItems(
      (prItems ?? []).map((it: any) => ({
        id: it.id,
        line_no: it.line_no,
        description: it.description,
        unit: it.unit,
        quantity: Number(it.quantity),
        pr_unit_price: Number(it.unit_price),
        po_unit_price: Number(it.unit_price), // เริ่มต้น = ราคา PR
      }))
    );
    setLoadingItems(false);
  }

  function updatePoPrice(index: number, value: number) {
    setItems((prev) =>
      prev.map((item, i) => i !== index ? item : { ...item, po_unit_price: value })
    );
  }

  // ── Attachments ──────────────────────────────────────────────────────────
  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(e.target.files ?? []);
    setAttachFiles((prev) => {
      const existing = new Set(prev.map((f) => f.name + f.size));
      return [...prev, ...selected.filter((f) => !existing.has(f.name + f.size))];
    });
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function removeFile(index: number) {
    setAttachFiles((prev) => prev.filter((_, i) => i !== index));
  }

  // ── Totals & validation ───────────────────────────────────────────────────
  const poTotal = items.reduce((s, it) => s + it.quantity * it.po_unit_price, 0);
  const prTotalAmount = selectedPr?.total_amount ?? 0;

  const itemsWithVariance = items.map((item) => ({
    ...item,
    variancePct: getVariancePct(item.po_unit_price, item.pr_unit_price),
    lineTotal: item.quantity * item.po_unit_price,
  }));

  const hasItemOverBudget = itemsWithVariance.some((it) => it.variancePct > PRICE_TOLERANCE);
  const isTotalOverBudget = prTotalAmount > 0 && poTotal > prTotalAmount * (1 + PRICE_TOLERANCE);
  const isOverBudget = hasItemOverBudget || isTotalOverBudget;

  // ── Submit ────────────────────────────────────────────────────────────────
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMessage(null);

    if (!selectedPrId) { setErrorMessage("กรุณาเลือกใบขอซื้อ"); return; }
    if (items.length === 0) { setErrorMessage("ไม่พบรายการสินค้าจาก PR"); return; }

    setIsSubmitting(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setErrorMessage("กรุณาล็อกอิน"); setIsSubmitting(false); return; }

    // สร้างเลข PO
    const { data: poNumber, error: rpcError } = await supabase.rpc("next_document_number", {
      prefix: "PO",
      table_name: "purchase_orders",
      column_name: "po_number",
    });
    if (rpcError) { setErrorMessage(rpcError.message); setIsSubmitting(false); return; }

    // คำนวณยอด
    const subtotal = poTotal;
    const vatRate = 7;
    const vatAmount = subtotal * vatRate / 100;
    const totalAmount = subtotal + vatAmount;

    // Insert purchase_order
    const { data: po, error: poError } = await (supabase as any)
      .from("purchase_orders")
      .insert({
        po_number: poNumber,
        pr_id: selectedPrId,
        pr_total_amount: prTotalAmount,
        vendor_name: vendorName.trim() || null,
        status: "draft",
        created_by: user.id,
        order_date: new Date().toISOString().split("T")[0],
        note: note.trim() || null,
        subtotal,
        vat_rate: vatRate,
        vat_amount: vatAmount,
        total_amount: totalAmount,
      })
      .select("id")
      .single();

    if (poError || !po) { setErrorMessage(poError?.message ?? "เกิดข้อผิดพลาด"); setIsSubmitting(false); return; }

    // Insert po_items พร้อม link pr_item_id + pr_unit_price
    const poItems = items.map((it, idx) => ({
      po_id: po.id,
      pr_item_id: it.id,
      pr_unit_price: it.pr_unit_price,
      line_no: idx + 1,
      description: it.description,
      quantity: it.quantity,
      unit: it.unit,
      unit_price: it.po_unit_price,
    }));
    const { error: itemsError } = await supabase.from("po_items").insert(poItems);
    if (itemsError) { setErrorMessage(itemsError.message); setIsSubmitting(false); return; }

    // อัปโหลดไฟล์แนบ
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
          uploaded_by: user.id,
        });
      }
    }

    router.push(`/orders/${po.id}`);
    router.refresh();
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <div className="flex items-center gap-3">
        <Link href="/orders" className="text-slate-400 hover:text-slate-600">
          <ArrowLeft size={20} />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-slate-800">สร้างใบสั่งซื้อ (PO)</h1>
          {!selectedPrId && (
            <p className="text-sm text-slate-400">เลือกใบขอซื้อที่อนุมัติแล้วเพื่อเริ่มสร้าง PO</p>
          )}
        </div>
      </div>

      {/* ── Step 1: เลือก PR จาก list ──────────────────────────────────── */}
      {!selectedPrId && (
        <div className="space-y-3">
          {approvedPRs.length === 0 ? (
            <div className="rounded-xl border border-slate-200 bg-white px-6 py-12 text-center shadow-sm">
              <p className="text-slate-400 text-sm">ไม่มีใบขอซื้อที่รออนุมัติ PO</p>
              <p className="text-slate-300 text-xs mt-1">PR ต้องได้รับการอนุมัติก่อนจึงจะสร้าง PO ได้</p>
            </div>
          ) : (
            approvedPRs.map((pr) => (
              <button
                key={pr.id}
                type="button"
                onClick={() => handlePrSelect(pr.id)}
                className="w-full rounded-xl border border-slate-200 bg-white px-5 py-4 text-left shadow-sm transition-all hover:border-blue-400 hover:shadow-md hover:bg-blue-50 group"
              >
                <div className="flex items-center justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-mono text-xs font-bold text-blue-600 bg-blue-100 px-2 py-0.5 rounded">
                        {pr.pr_number}
                      </span>
                      <span className="rounded-full bg-green-100 px-2 py-0.5 text-[11px] font-semibold text-green-700">
                        อนุมัติแล้ว
                      </span>
                    </div>
                    <p className="font-semibold text-slate-800 group-hover:text-blue-800 truncate">
                      {pr.title}
                    </p>
                    <p className="text-xs text-slate-400 mt-0.5">ผู้ขอ: {pr.requester_name}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-[11px] text-slate-400">งบประมาณ PR</p>
                    <p className="font-bold text-slate-800 group-hover:text-blue-700">
                      ฿{pr.total_amount.toLocaleString("th-TH", { minimumFractionDigits: 2 })}
                    </p>
                    <p className="text-[10px] text-blue-400 mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      คลิกเพื่อเลือก →
                    </p>
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
      )}

      {/* ── Step 2: กรอกข้อมูล PO หลังเลือก PR แล้ว ──────────────────── */}
      {selectedPrId && (
      <form onSubmit={handleSubmit} className="space-y-5">

        {/* PR ที่เลือก + เปลี่ยน */}
        <div className="rounded-xl border border-blue-200 bg-blue-50 px-5 py-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-widest text-blue-400 mb-1">
                ใบขอซื้อที่เลือก
              </p>
              <div className="flex items-center gap-2">
                <span className="font-mono text-sm font-bold text-blue-700 bg-blue-100 px-2 py-0.5 rounded">
                  {selectedPr?.pr_number}
                </span>
                <span className="font-semibold text-blue-800">{selectedPr?.title}</span>
              </div>
              <p className="text-xs text-blue-400 mt-0.5">
                ผู้ขอ: {selectedPr?.requester_name} · งบ PR: ฿{selectedPr?.total_amount.toLocaleString("th-TH", { minimumFractionDigits: 2 })}
              </p>
            </div>
            <button
              type="button"
              onClick={() => { setSelectedPrId(""); setSelectedPr(null); setItems([]); }}
              className="shrink-0 rounded-lg border border-blue-200 bg-white px-3 py-1.5 text-xs font-medium text-blue-600 transition hover:bg-blue-100"
            >
              เปลี่ยน PR
            </button>
          </div>
        </div>

        {/* ร้านค้า */}
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <label className="mb-1 block text-sm font-medium text-slate-700">ร้านค้า / ผู้จำหน่าย</label>
          <input
            type="text"
            value={vendorName}
            onChange={(e) => setVendorName(e.target.value)}
            placeholder="ชื่อร้าน หรือบริษัทที่ซื้อมา"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
          />
        </div>

        {/* ── ตารางราคาจริงที่ได้มา vs ราคา PR ─────────────────── */}
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-100 px-6 py-4">
              <h2 className="font-semibold text-slate-700">ราคาสินค้าที่ได้มา vs ราคา PR</h2>
              <p className="mt-0.5 text-xs text-slate-400">
                กรอกราคาที่ซื้อจริง — ห้ามเกินราคา PR เกิน 10%
              </p>
            </div>

            {loadingItems ? (
              <div className="px-6 py-8 text-center text-sm text-slate-400">กำลังโหลดรายการ...</div>
            ) : (
              <>
                <table className="min-w-full text-sm">
                  <thead className="border-b border-slate-100 bg-slate-50">
                    <tr>
                      <th className="px-4 py-2 text-left font-medium text-slate-500 w-8">#</th>
                      <th className="px-4 py-2 text-left font-medium text-slate-500">รายการสินค้า</th>
                      <th className="px-4 py-2 text-right font-medium text-slate-500">จำนวน</th>
                      <th className="px-4 py-2 text-right font-medium text-slate-400">ราคา PR (อ้างอิง)</th>
                      <th className="px-4 py-2 text-right font-medium text-blue-600">ราคาที่ได้มาจริง</th>
                      <th className="px-4 py-2 text-right font-medium text-slate-500">ต่าง%</th>
                      <th className="px-4 py-2 text-right font-medium text-slate-500">รวม</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {itemsWithVariance.map((item, idx) => {
                      const isOver = item.variancePct > PRICE_TOLERANCE;
                      return (
                        <tr key={item.id} className={isOver ? "bg-red-50" : undefined}>
                          <td className="px-4 py-3 text-slate-400">{item.line_no}</td>
                          <td className="px-4 py-3 font-medium text-slate-800">{item.description}</td>
                          <td className="px-4 py-3 text-right text-slate-600">
                            {Number(item.quantity).toLocaleString("th-TH")} {item.unit}
                          </td>
                          {/* ราคา PR — readonly */}
                          <td className="px-4 py-3 text-right text-slate-400">
                            ฿{item.pr_unit_price.toLocaleString("th-TH", { minimumFractionDigits: 2 })}
                          </td>
                          {/* ราคาจริงที่ซื้อมา — editable */}
                          <td className="px-4 py-3 text-right">
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={item.po_unit_price}
                              onChange={(e) => updatePoPrice(idx, parseFloat(e.target.value) || 0)}
                              className={`w-28 rounded border px-2 py-1 text-right text-sm focus:outline-none ${
                                isOver
                                  ? "border-red-400 bg-red-50 focus:border-red-500 text-red-700"
                                  : "border-blue-300 bg-blue-50 focus:border-blue-500 text-blue-900"
                              }`}
                            />
                          </td>
                          {/* ต่าง% */}
                          <td className="px-4 py-3 text-right">
                            <span className={`text-xs font-semibold ${isOver ? "text-red-600" : "text-green-600"}`}>
                              {isOver && <AlertTriangle size={11} className="mr-0.5 inline" />}
                              {item.variancePct >= 0 ? "+" : ""}
                              {(item.variancePct * 100).toFixed(1)}%
                            </span>
                          </td>
                          {/* รวม */}
                          <td className="px-4 py-3 text-right font-medium text-slate-800">
                            ฿{item.lineTotal.toLocaleString("th-TH", { minimumFractionDigits: 2 })}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot className="border-t border-slate-200 bg-slate-50">
                    <tr>
                      <td colSpan={3} />
                      <td className="px-4 py-2 text-right text-xs text-slate-400">
                        รวม PR: ฿{prTotalAmount.toLocaleString("th-TH", { minimumFractionDigits: 2 })}
                      </td>
                      <td colSpan={2} className="px-4 py-2 text-right text-xs font-medium text-slate-500">
                        รวมที่ได้มา (ก่อน VAT):
                      </td>
                      <td className="px-4 py-2 text-right font-bold text-slate-900">
                        ฿{poTotal.toLocaleString("th-TH", { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                  </tfoot>
                </table>

                {/* Budget alert / ok */}
                <div className="px-4 pb-4">
                  {isOverBudget ? (
                    <div className="flex items-start gap-2 rounded-lg border border-orange-200 bg-orange-50 px-4 py-3">
                      <AlertTriangle size={15} className="mt-0.5 shrink-0 text-orange-500" />
                      <div>
                        <p className="text-sm font-semibold text-orange-700">ราคาเกินงบ PR เกิน 10%</p>
                        <p className="text-xs text-orange-600 mt-0.5">
                          {isTotalOverBudget
                            ? `ยอดรวม ฿${poTotal.toLocaleString("th-TH", { minimumFractionDigits: 2 })} เกินงบ PR — `
                            : "มีรายการที่ราคาเกินงบ PR — "}
                          สามารถบันทึกได้ แต่ผู้อนุมัติจะเห็นความแตกต่างและต้องพิจารณาก่อนอนุมัติ
                        </p>
                      </div>
                    </div>
                  ) : items.length > 0 ? (
                    <div className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-4 py-2.5">
                      <CheckCircle2 size={14} className="text-green-600" />
                      <p className="text-sm text-green-700">ราคาอยู่ในเกณฑ์ที่กำหนด</p>
                    </div>
                  ) : null}
                </div>
              </>
            )}
          </div>

        {/* ── แนบบิล / ใบเสร็จ ────────────────────────────────────── */}
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="mb-1 font-semibold text-slate-700">แนบบิล / ใบเสร็จ</h2>
          <p className="mb-4 text-xs text-slate-400">อัปโหลดบิลหรือใบเสร็จจากร้านค้า (รูปภาพหรือ PDF)</p>

          <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 px-4 py-7 text-center transition-colors hover:border-blue-400 hover:bg-blue-50">
            <Paperclip size={20} className="text-slate-400" />
            <p className="text-sm font-medium text-slate-600">คลิกเพื่อเลือกไฟล์</p>
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
            <ul className="mt-4 space-y-2">
              {attachFiles.map((file, i) => {
                const isImage = file.type.startsWith("image/");
                const previewUrl = isImage ? URL.createObjectURL(file) : null;
                return (
                  <li key={i} className="flex items-center gap-3 rounded-lg border border-slate-100 bg-white px-3 py-2">
                    {previewUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={previewUrl} alt={file.name}
                        className="h-10 w-10 shrink-0 rounded-md object-cover border border-slate-200" />
                    ) : (
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-red-50">
                        <FileText size={18} className="text-red-400" />
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

        {/* ── หมายเหตุ ──────────────────────────────────────────────── */}
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="mb-3 font-semibold text-slate-700">หมายเหตุ</h2>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            placeholder="หมายเหตุเพิ่มเติม (ถ้ามี)"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
          />
        </div>

        {errorMessage && (
          <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3">
            <AlertTriangle size={15} className="text-red-500" />
            <p className="text-sm text-red-700">{errorMessage}</p>
          </div>
        )}

        <div className="flex justify-end gap-3">
          <Link href="/orders"
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50">
            ยกเลิก
          </Link>
          <button
            type="submit"
            disabled={isSubmitting || !selectedPrId}
            className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-blue-700 disabled:opacity-60"
          >
            {isSubmitting ? "กำลังบันทึก..." : "บันทึก PO (ร่าง)"}
          </button>
        </div>
      </form>
      )}
    </div>
  );
}
