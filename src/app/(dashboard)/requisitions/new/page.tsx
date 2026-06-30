"use client";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import {
  ArrowLeft, Plus, Trash2, Building2, User,
  Paperclip, FileText, ImageIcon, X as XIcon,
} from "lucide-react";
import { CompanySelector, getBranchBorderColor } from "@/components/shared/CompanySelector";
import { DateTimePicker } from "@/components/shared/DateTimePicker";
import type { Branch } from "@/types/database";

// -----------------------------------------------------------------------
// รายชื่อธนาคารไทยที่นิยม
// -----------------------------------------------------------------------
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

// -----------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------
interface Product {
  id: string;
  name: string;
  sku: string;
  unit: string;
  unit_price: number;
}

interface PRItem {
  product_id: string;
  description: string;
  unit: string;
  quantity: number;
  unit_price: number;
}

const EMPTY_ITEM: PRItem = { product_id: "", description: "", unit: "", quantity: 1, unit_price: 0 };

// -----------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------
export default function NewRequisitionPage() {
  const router = useRouter();
  const supabase = createClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── General state ───────────────────────────────────────────────────
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // ── Products & branches ─────────────────────────────────────────────
  const [products, setProducts] = useState<Product[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [branchId, setBranchId] = useState("");
  const [branchFromMemory, setBranchFromMemory] = useState(false);

  // ── Requester info ──────────────────────────────────────────────────
  const [requesterName, setRequesterName] = useState("");
  const [requesterAvatar, setRequesterAvatar] = useState<string | null>(null);
  const [userDepartment, setUserDepartment] = useState<string | null>(null);

  // ── Form fields ─────────────────────────────────────────────────────
  const [isUrgent, setIsUrgent] = useState(false);
  const [neededBy, setNeededBy] = useState(() => new Date().toISOString());
  const [bankName, setBankName] = useState("");
  const [bankAccount, setBankAccount] = useState("");

  // ── Items ───────────────────────────────────────────────────────────
  const [items, setItems] = useState<PRItem[]>([{ ...EMPTY_ITEM }]);

  // ── Attachments ─────────────────────────────────────────────────────
  const [attachFiles, setAttachFiles] = useState<File[]>([]);

  // ── Load data ───────────────────────────────────────────────────────
  useEffect(() => {
    async function loadAll() {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const avatar = user.user_metadata?.avatar_url as string | undefined;
        if (avatar) setRequesterAvatar(avatar);

        const { data: profile } = await (supabase as any)
          .from("profiles")
          .select("full_name, branch_id, department")
          .eq("id", user.id)
          .single();

        setRequesterName(
          profile?.full_name || user.user_metadata?.full_name || user.email || ""
        );
        setUserDepartment(profile?.department ?? null);

        const { data: branchData } = await (supabase as any)
          .from("branches")
          .select("*")
          .eq("is_active", true)
          .order("code");
        const list: Branch[] = branchData ?? [];
        setBranches(list);

        const saved = localStorage.getItem("last_branch_id");
        if (saved && list.some((b) => b.id === saved)) {
          setBranchId(saved);
          setBranchFromMemory(true);
        } else if (profile?.branch_id && list.some((b: Branch) => b.id === profile.branch_id)) {
          setBranchId(profile.branch_id);
        } else if (list.length > 0) {
          setBranchId(list[0].id);
        }
      }

      const { data: productData } = await supabase
        .from("products")
        .select("id, name, sku, unit, unit_price")
        .eq("is_active", true)
        .order("name");
      setProducts(productData ?? []);
    }
    loadAll();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectedBranch = branches.find((b) => b.id === branchId);
  const borderColor = getBranchBorderColor(selectedBranch?.code);
  const initials = requesterName.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase() || "?";

  // ── Items helpers ───────────────────────────────────────────────────
  function addItem() { setItems((p) => [...p, { ...EMPTY_ITEM }]); }
  function removeItem(i: number) { setItems((p) => p.filter((_, idx) => idx !== i)); }

  function updateItem(index: number, field: keyof PRItem, value: string | number) {
    setItems((prev) => prev.map((item, i) => i !== index ? item : { ...item, [field]: value }));
  }

  function applyProduct(index: number, productId: string) {
    setItems((prev) =>
      prev.map((item, i) => {
        if (i !== index) return item;
        if (!productId) return { ...item, product_id: "", unit: "", unit_price: 0 };
        const p = products.find((prod) => prod.id === productId);
        if (!p) return item;
        return { ...item, product_id: productId, unit: p.unit, unit_price: p.unit_price };
      })
    );
  }

  // ── Attachment helpers ──────────────────────────────────────────────
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

  function formatFileSize(bytes: number) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  const totalAmount = items.reduce((s, it) => s + it.quantity * it.unit_price, 0);

  // ── Submit ──────────────────────────────────────────────────────────
  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setErrorMessage(null);

    if (!branchId) { setErrorMessage("กรุณาเลือกบริษัท"); setIsSubmitting(false); return; }
    if (items.some((it) => !it.description.trim())) {
      setErrorMessage("กรุณากรอกรายละเอียดสินค้าให้ครบทุกรายการ");
      setIsSubmitting(false);
      return;
    }

    const formData = new FormData(event.currentTarget);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setErrorMessage("กรุณาล็อกอินก่อน"); setIsSubmitting(false); return; }

    const branchCode = selectedBranch?.code ?? "PR";
    const { data: prNumber, error: rpcError } = await supabase.rpc("next_document_number", {
      prefix: branchCode,
      table_name: "purchase_requisitions",
      column_name: "pr_number",
    });
    if (rpcError) { setErrorMessage(rpcError.message); setIsSubmitting(false); return; }

    const { data: pr, error: prError } = await (supabase as any)
      .from("purchase_requisitions")
      .insert({
        pr_number: prNumber,
        title: formData.get("title") as string,
        requester_id: user.id,
        branch_id: branchId,
        department: userDepartment || null,
        needed_by: neededBy || null,
        note: (formData.get("note") as string) || null,
        is_urgent: isUrgent,
        bank_name: bankName || null,
        bank_account_number: bankAccount || null,
        total_amount: totalAmount,
        status: "draft",
      })
      .select("id")
      .single();

    if (prError || !pr) { setErrorMessage(prError?.message ?? "เกิดข้อผิดพลาด"); setIsSubmitting(false); return; }

    // บันทึกรายการสินค้า
    const prItems = items.map((it, i) => ({
      pr_id: pr.id,
      line_no: i + 1,
      product_id: it.product_id || null,
      description: it.description.trim(),
      quantity: it.quantity,
      unit: it.unit || "ชิ้น",
      unit_price: it.unit_price,
    }));
    const { error: itemsError } = await supabase.from("pr_items").insert(prItems);
    if (itemsError) { setErrorMessage(itemsError.message); setIsSubmitting(false); return; }

    // อัปโหลดไฟล์แนบ
    if (attachFiles.length > 0) {
      for (const file of attachFiles) {
        const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
        const path = `${pr.id}/${Date.now()}_${safeName}`;
        const { error: uploadErr } = await supabase.storage
          .from("pr-attachments")
          .upload(path, file, { upsert: false });
        if (!uploadErr) {
          const { data: { publicUrl } } = supabase.storage
            .from("pr-attachments")
            .getPublicUrl(path);
          await (supabase as any).from("pr_attachments").insert({
            pr_id: pr.id,
            file_name: file.name,
            file_url: publicUrl,
            file_type: file.type.startsWith("image/") ? "image" : "pdf",
            file_size: file.size,
            uploaded_by: user.id,
          });
        }
      }
    }

    router.push(`/requisitions/${pr.id}`);
    router.refresh();
  }

  // ── Render ──────────────────────────────────────────────────────────
  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div className="space-y-2">
        <div className="flex items-center gap-3">
          <Link href="/requisitions" className="text-slate-400 hover:text-slate-600">
            <ArrowLeft size={20} />
          </Link>
          <h1 className="text-xl font-bold text-slate-800">สร้างใบขอซื้อใหม่</h1>
        </div>

        {/* Company selector ใต้หัวข้อ */}
        {branches.length > 0 && (
          <div className="flex items-center gap-2 pl-8">
            <CompanySelector branches={branches} selectedId={branchId}
              onChange={(id) => {
                setBranchId(id);
                setBranchFromMemory(false);
                localStorage.setItem("last_branch_id", id);
              }}
            />
            {branchFromMemory && selectedBranch && (
              <span className="flex items-center gap-1 text-[10px] text-slate-400">
                <Building2 size={9} /> จำไว้จากครั้งล่าสุด
              </span>
            )}
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">

        {/* ── ข้อมูลหลัก ────────────────────────────────────────────── */}
        <div className={`space-y-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm border-l-4 ${borderColor} transition-colors`}>

          {/* ผู้ขอ */}
          <div className="flex items-center gap-2.5">
            {requesterAvatar ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={requesterAvatar} alt={requesterName} referrerPolicy="no-referrer"
                className="h-9 w-9 rounded-full object-cover ring-2 ring-slate-200" />
            ) : (
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white ring-2 ring-slate-200">
                {initials || <User size={14} />}
              </div>
            )}
            <div>
              <p className="text-[11px] text-slate-400">ผู้ขอ</p>
              <p className="text-sm font-semibold text-slate-800 leading-tight">
                {requesterName || "กำลังโหลด..."}
              </p>
            </div>
          </div>

          {/* ชื่อเรื่อง */}
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              ชื่อ/เรื่อง <span className="text-red-500">*</span>
            </label>
            <input name="title" required placeholder="เช่น ขอซื้อกระดาษ A4 ประจำไตรมาส Q3"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none" />
          </div>

          {/* ด่วน */}
          <div className="flex items-center justify-between rounded-lg border border-slate-200 px-4 py-3">
            <div>
              <p className="text-sm font-medium text-slate-700">งานด่วน</p>
              <p className="text-xs text-slate-400">ข้ามขั้นตอนอนุมัติรอบ 2 เมื่อยอดจริงเกินงบ</p>
            </div>
            <button type="button" onClick={() => setIsUrgent((v) => !v)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${isUrgent ? "bg-red-500" : "bg-slate-200"}`}>
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${isUrgent ? "translate-x-6" : "translate-x-1"}`} />
            </button>
          </div>

          {/* วันที่ต้องการ */}
          <div>
            <div>
              <DateTimePicker label="วันที่ต้องการ" value={neededBy} onChange={setNeededBy} />
            </div>
          </div>

          {/* หมายเหตุ */}
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">หมายเหตุ</label>
            <textarea name="note" rows={2} placeholder="รายละเอียดเพิ่มเติม"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none" />
          </div>
        </div>

        {/* ── รายการสินค้า ───────────────────────────────────────────── */}
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
            <h2 className="font-semibold text-slate-700">รายการสินค้า / บริการ</h2>
            <button type="button" onClick={addItem}
              className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800">
              <Plus size={15} /> เพิ่มรายการ
            </button>
          </div>

          <div className="divide-y divide-slate-100">
            {items.map((item, index) => (
              <div key={index} className="px-5 py-4 space-y-2">
                <div className="flex items-center gap-2">
                  <span className="w-5 shrink-0 text-xs font-medium text-slate-400">{index + 1}.</span>
                  <input value={item.description}
                    onChange={(e) => updateItem(index, "description", e.target.value)}
                    placeholder="รายละเอียดสินค้า / บริการ *"
                    className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none" />
                  {items.length > 1 && (
                    <button type="button" onClick={() => removeItem(index)}
                      className="shrink-0 rounded p-1.5 text-slate-300 transition-colors hover:bg-red-50 hover:text-red-500">
                      <Trash2 size={15} />
                    </button>
                  )}
                </div>

                <div className="ml-7 flex flex-wrap items-center gap-2 text-sm">
                  <select value={item.product_id} onChange={(e) => applyProduct(index, e.target.value)}
                    className="rounded border border-slate-200 bg-slate-50 px-2 py-1.5 text-xs text-slate-600 focus:border-blue-400 focus:outline-none">
                    <option value="">— ระบุเอง —</option>
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>[{p.sku}] {p.name}</option>
                    ))}
                  </select>

                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-slate-400">จำนวน</span>
                    <input type="number" step="any" value={item.quantity || ""}
                      onChange={(e) => updateItem(index, "quantity", parseFloat(e.target.value) || 0)}
                      className="w-20 rounded border border-slate-300 px-2 py-1.5 text-right text-sm focus:border-blue-500 focus:outline-none" />
                  </div>

                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-slate-400">หน่วย</span>
                    <input value={item.unit} onChange={(e) => updateItem(index, "unit", e.target.value)}
                      placeholder="ชิ้น"
                      className="w-16 rounded border border-slate-300 px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none" />
                  </div>

                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-slate-400">ราคา/หน่วย</span>
                    <input type="number" min="0" step="0.01" value={item.unit_price}
                      onChange={(e) => updateItem(index, "unit_price", parseFloat(e.target.value) || 0)}
                      className="w-28 rounded border border-slate-300 px-2 py-1.5 text-right text-sm focus:border-blue-500 focus:outline-none" />
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

        {/* ── บัญชีธนาคาร ────────────────────────────────────────────── */}
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 font-semibold text-slate-700">บัญชีธนาคาร (สำหรับรับเงิน)</h2>
          <div className="grid grid-cols-2 gap-4">
            {/* เลือกธนาคาร */}
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">ธนาคาร</label>
              <select value={bankName} onChange={(e) => setBankName(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 focus:border-blue-500 focus:outline-none">
                <option value="">— เลือกธนาคาร —</option>
                {THAI_BANKS.map((b) => (
                  <option key={b.code} value={b.code}>{b.label}</option>
                ))}
              </select>
            </div>
            {/* เลขบัญชี */}
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">เลขที่บัญชี</label>
              <input value={bankAccount} onChange={(e) => setBankAccount(e.target.value)}
                placeholder="เช่น 123-4-56789-0"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono tracking-wider focus:border-blue-500 focus:outline-none" />
            </div>
          </div>
        </div>

        {/* ── ไฟล์แนบ ────────────────────────────────────────────────── */}
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 font-semibold text-slate-700">ไฟล์แนบ</h2>

          {/* Drop zone / select button */}
          <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center transition-colors hover:border-blue-400 hover:bg-blue-50">
            <Paperclip size={22} className="text-slate-400" />
            <p className="text-sm font-medium text-slate-600">คลิกเพื่อเลือกไฟล์</p>
            <p className="text-xs text-slate-400">รองรับ JPG, PNG, WEBP, PDF — หลายไฟล์ได้</p>
            <input ref={fileInputRef} type="file" multiple
              accept="image/jpeg,image/png,image/webp,application/pdf"
              onChange={handleFileChange} className="hidden" />
          </label>

          {/* Preview list */}
          {attachFiles.length > 0 && (
            <ul className="mt-4 space-y-2">
              {attachFiles.map((file, i) => {
                const isImage = file.type.startsWith("image/");
                const previewUrl = isImage ? URL.createObjectURL(file) : null;
                return (
                  <li key={i} className="flex items-center gap-3 rounded-lg border border-slate-100 bg-white px-3 py-2">
                    {/* Thumbnail / icon */}
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
                        {isImage ? <ImageIcon size={10} className="mr-1 inline" /> : <FileText size={10} className="mr-1 inline" />}
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

        {errorMessage && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{errorMessage}</p>
        )}

        <div className="flex justify-end gap-3">
          <Link href="/requisitions"
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50">
            ยกเลิก
          </Link>
          <button type="submit" disabled={isSubmitting}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-blue-700 disabled:opacity-60">
            {isSubmitting ? "กำลังบันทึก..." : "บันทึกเป็นร่าง"}
          </button>
        </div>
      </form>
    </div>
  );
}
