"use client";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import {
  ArrowLeft, Plus, Trash2, Building2, User,
  Paperclip, FileText, ImageIcon, X as XIcon,
  HelpCircle, CheckCircle2, AlertCircle, Clock, Send,
  ChevronRight, ChevronLeft, ChevronDown,
} from "lucide-react";
import { CompanySelector, getBranchBorderColor } from "@/components/shared/CompanySelector";
import { logAudit } from "@/lib/supabase/audit";
import { getNextPaymentDate, formatPaymentDate } from "@/lib/utils/paymentSchedule";
import type { Branch } from "@/types/database";

// -----------------------------------------------------------------------
// รายชื่อธนาคารไทยที่นิยม
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

interface CategoryOpt {
  id: string;
  code: string | null;
  name: string;
  mode: number;
  is_active: boolean;
  position_id: string | null;
}

const CATEGORY_MODE_LABELS: Record<number, string> = {
  1: "MODE 1 · จัดซื้อทั่วไป",
  2: "MODE 2 · ช่าง (เร็วๆ นี้)",
};

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
  const [showHelp, setShowHelp] = useState(false);

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

  // ── หมวด + ผู้อนุมัติ ───────────────────────────────────────────────
  const [categories, setCategories] = useState<CategoryOpt[]>([]);
  const [categoryId, setCategoryId] = useState("");
  const [positionMembers, setPositionMembers] = useState<Record<string, string[]>>({});
  const [deptHeads, setDeptHeads] = useState<string[]>([]);

  // ── Items ───────────────────────────────────────────────────────────
  const [rawInputs, setRawInputs] = useState<Record<string, string>>({});
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

        // หัวหน้าแผนก = manager/admin ในแผนกเดียวกัน
        if (profile?.department) {
          const { data: heads } = await (supabase as any)
            .from("profiles")
            .select("full_name")
            .eq("department", profile.department)
            .in("role", ["manager", "admin"]);
          setDeptHeads((heads ?? []).map((h: any) => h.full_name).filter(Boolean));
        }

        // หมวด + สมาชิกตำแหน่ง (สำหรับ preview ผู้อนุมัติ)
        const [{ data: catData }, { data: memberData }] = await Promise.all([
          (supabase as any)
            .from("categories")
            .select("id, code, name, mode, is_active, position_id")
            .order("mode")
            .order("sort_order"),
          (supabase as any)
            .from("position_members")
            .select("position_id, profiles!user_id(full_name)"),
        ]);
        setCategories(catData ?? []);
        const memberMap: Record<string, string[]> = {};
        for (const m of memberData ?? []) {
          const nm = m.profiles?.full_name;
          if (!nm) continue;
          (memberMap[m.position_id] ??= []).push(nm);
        }
        setPositionMembers(memberMap);

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

  // ── ผู้อนุมัติ = หัวหน้าแผนก + สมาชิกตำแหน่งของหมวดที่เลือก ──
  const selectedCategory = categories.find((c) => c.id === categoryId);
  const positionApprovers = selectedCategory?.position_id
    ? (positionMembers[selectedCategory.position_id] ?? [])
    : [];
  const approverNames = [...new Set([...deptHeads, ...positionApprovers])];
  const categoryModes = [...new Set(categories.map((c) => c.mode))].sort((a, b) => a - b);

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
        if (!productId) return { ...item, product_id: "", description: "", unit: "", unit_price: 0 };
        const p = products.find((prod) => prod.id === productId);
        if (!p) return item;
        return { ...item, product_id: productId, description: p.name, unit: p.unit, unit_price: p.unit_price };
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
    if (!categoryId || !selectedCategory) { setErrorMessage("กรุณาเลือกหมวด"); setIsSubmitting(false); return; }
    if (items.some((it) => !it.description.trim())) {
      setErrorMessage("กรุณากรอกรายละเอียดสินค้าให้ครบทุกรายการ");
      setIsSubmitting(false);
      return;
    }

    const formData = new FormData(event.currentTarget);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setErrorMessage("กรุณาล็อกอินก่อน"); setIsSubmitting(false); return; }

    const { data: prNumber, error: rpcError } = await (supabase as any).rpc("next_pr_number");
    if (rpcError) { setErrorMessage(rpcError.message); setIsSubmitting(false); return; }

    // title ของ PR = ชื่อหมวด
    const prTitle = selectedCategory.name;

    const { data: pr, error: prError } = await (supabase as any)
      .from("purchase_requisitions")
      .insert({
        pr_number: prNumber,
        title: prTitle,
        category_id: categoryId,
        requester_id: user.id,
        branch_id: branchId,
        department: userDepartment || null,
        note: (formData.get("note") as string) || null,
        is_urgent: isUrgent,
        total_amount: totalAmount,
        status: "draft",
      })
      .select("id")
      .single();

    if (prError || !pr) { setErrorMessage(prError?.message ?? "เกิดข้อผิดพลาด"); setIsSubmitting(false); return; }

    logAudit({
      actorId: user.id,
      action: "pr_created",
      entity: "purchase_requisitions",
      entityId: pr.id,
      metadata: { pr_number: prNumber, title: prTitle, category_id: categoryId },
    });

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
      <div className="flex items-center gap-3">
        <Link href="/requisitions" className="text-slate-400 hover:text-slate-600">
          <ArrowLeft size={20} />
        </Link>
        <h1 className="text-xl font-bold text-slate-800">สร้างใบขอซื้อใหม่</h1>
        <button
          type="button"
          onClick={() => setShowHelp(true)}
          className="ml-1 flex items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-medium text-blue-600 hover:bg-blue-100 transition-colors"
        >
          <HelpCircle size={13} />
          คู่มือการใช้งาน
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">

        {/* ── card เดียวรวมทุกส่วน ───────────────────────────────────── */}
        <div className={`rounded-xl border border-slate-200 bg-white shadow-sm border-l-4 ${borderColor} transition-colors`}>

          {/* ── ส่วนบน: ผู้ขอ + ชื่อเรื่อง + options ── */}
          <div className="space-y-4 p-6">

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

            {/* หมวด (แทนช่องชื่อ) + ผู้อนุมัติ */}
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                หมวด <span className="text-red-500">*</span>
              </label>
              <select
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                required
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              >
                <option value="">— เลือกหมวด —</option>
                {categoryModes.map((mode) => (
                  <optgroup key={mode} label={CATEGORY_MODE_LABELS[mode] ?? `MODE ${mode}`}>
                    {categories
                      .filter((c) => c.mode === mode)
                      .map((c) => (
                        <option key={c.id} value={c.id} disabled={!c.is_active}>
                          {c.code ? `[${c.code}] ` : ""}{c.name}{!c.is_active ? " (เร็วๆ นี้)" : ""}
                        </option>
                      ))}
                  </optgroup>
                ))}
              </select>

              {/* preview ผู้อนุมัติ */}
              {categoryId && (
                <div className="mt-1.5 flex items-start gap-1.5 rounded-lg bg-blue-50 px-3 py-2 text-[11px] text-blue-700">
                  <User size={12} className="mt-0.5 shrink-0" />
                  <span>
                    ผู้อนุมัติ:{" "}
                    {approverNames.length > 0 ? (
                      <span className="font-medium">{approverNames.join(", ")}</span>
                    ) : (
                      <span className="text-amber-600">— ยังไม่มีผู้อนุมัติในระบบ (เพิ่มหัวหน้าแผนก/สมาชิกตำแหน่ง) —</span>
                    )}
                  </span>
                </div>
              )}
            </div>

            {/* งานด่วน | สาขา | วันที่ — inline row */}
            <div className="flex flex-col divide-y divide-slate-100 rounded-xl border border-slate-100 bg-slate-50 sm:flex-row sm:divide-x sm:divide-y-0">

              {/* งานด่วน */}
              <div className={`flex flex-1 items-center justify-between px-4 py-3 transition-colors ${isUrgent ? "bg-red-50" : ""}`}>
                <div>
                  <p className={`text-sm font-semibold ${isUrgent ? "text-red-700" : "text-slate-700"}`}>งานด่วน</p>
                  <p className="text-[10px] text-slate-400">เฉพาะฉุกเฉิน</p>
                </div>
                <button type="button" onClick={() => setIsUrgent((v) => !v)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${isUrgent ? "bg-red-500" : "bg-slate-300"}`}>
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${isUrgent ? "translate-x-6" : "translate-x-1"}`} />
                </button>
              </div>

              {/* สาขา */}
              <div className="flex flex-1 flex-col justify-center px-4 py-3">
                <p className="mb-1.5 text-[10px] font-medium text-slate-400">สาขา</p>
                {branches.length > 0 && (
                  <CompanySelector compact branches={branches} selectedId={branchId}
                    onChange={(id) => {
                      setBranchId(id);
                      setBranchFromMemory(false);
                      localStorage.setItem("last_branch_id", id);
                    }}
                  />
                )}
                {branchFromMemory && selectedBranch && (
                  <span className="mt-1 flex items-center gap-1 text-[10px] text-slate-400">
                    <Building2 size={9} /> จำไว้จากครั้งล่าสุด
                  </span>
                )}
              </div>

              {/* กำหนดจ่ายเงิน (ฟิกโดย บช.) */}
              <div className="flex flex-1 flex-col justify-center px-4 py-3">
                <p className="mb-1 text-[10px] font-medium text-slate-400">กำหนดจ่ายเงิน</p>
                <div className="flex items-center gap-1.5">
                  <span className="inline-flex items-center gap-1 rounded-full bg-violet-100 px-2.5 py-0.5 text-[11px] font-medium text-violet-700">
                    ทุกวันพุธ &amp; ศุกร์
                  </span>
                </div>
                <p className="mt-1 text-[10px] text-slate-400">
                  ถัดไป: {formatPaymentDate(getNextPaymentDate())}
                </p>
              </div>

            </div>
          </div>

          {/* ── เหตุผลในการสั่งซื้อ ── */}
          <div className="border-t border-slate-100 px-6 py-4">
            <label className="mb-1.5 block text-sm font-medium text-slate-700">
              เหตุผลในการสั่งซื้อ <span className="font-normal text-slate-400">(ถ้ามี)</span>
            </label>
            <textarea name="note" rows={2} placeholder="ระบุเหตุผลหรือความจำเป็นในการสั่งซื้อครั้งนี้"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none" />
          </div>

          {/* ── รายการสินค้า ── */}
          <div className="border-t border-slate-100">
            <div className="flex items-center justify-between px-6 py-4">
              <h2 className="font-semibold text-slate-700">รายการสินค้า</h2>
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
                    <input
                      value={item.description}
                      onChange={(e) => updateItem(index, "description", e.target.value)}
                      placeholder="รายละเอียดสินค้า *"
                      required
                      className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                    />
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
                      <option value="">ระบุสินค้าเพิ่ม</option>
                      {products.map((p) => (
                        <option key={p.id} value={p.id}>[{p.sku}] {p.name}</option>
                      ))}
                    </select>

                    <div className="flex items-center gap-1.5">
                      <span className="text-xs text-slate-400">จำนวน</span>
                      <input type="text" inputMode="decimal"
                        value={rawInputs[`${index}_q`] ?? String(item.quantity || "")}
                        onChange={(e) => {
                          setRawInputs(p => ({ ...p, [`${index}_q`]: e.target.value }));
                          updateItem(index, "quantity", parseFloat(e.target.value) || 0);
                        }}
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
                      <input type="text" inputMode="decimal"
                        value={rawInputs[`${index}_p`] ?? String(item.unit_price)}
                        onChange={(e) => {
                          setRawInputs(p => ({ ...p, [`${index}_p`]: e.target.value }));
                          updateItem(index, "unit_price", parseFloat(e.target.value) || 0);
                        }}
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

            <div className="flex items-center justify-end gap-3 border-t border-slate-100 bg-slate-50 px-6 py-3">
              <span className="text-sm font-semibold text-slate-700">รวมทั้งสิ้น</span>
              <span className="text-lg font-bold text-blue-700">
                ฿{totalAmount.toLocaleString("th-TH", { minimumFractionDigits: 2 })}
              </span>
            </div>
          </div>

        </div>

        {/* ── ใบเสนอราคา ──────────────────────────────────────────────── */}
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="mb-1 font-semibold text-slate-700">ใบเสนอราคา</h2>
          <p className="mb-4 text-xs text-slate-400">แนบใบเสนอราคาจากผู้ขาย (ถ้ามี)</p>

          {/* Drop zone / select button */}
          <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center transition-colors hover:border-blue-400 hover:bg-blue-50">
            <Paperclip size={22} className="text-slate-400" />
            <p className="text-sm font-medium text-slate-600">คลิกเพื่อแนบใบเสนอราคา</p>
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

      {/* ── Help Modal ──────────────────────────────────────────────────── */}
      {showHelp && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
          onClick={() => setShowHelp(false)}
        >
          <div
            className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl bg-white shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="sticky top-0 z-10 flex items-center justify-between rounded-t-2xl border-b border-slate-100 bg-white px-6 py-4">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-100">
                  <FileText size={16} className="text-blue-600" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-slate-800">คู่มือการสร้างใบขอซื้อ</h2>
                  <p className="text-[11px] text-slate-400">Purchase Request Guide</p>
                </div>
              </div>
              <button onClick={() => setShowHelp(false)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600">
                <XIcon size={16} />
              </button>
            </div>

            {/* Content */}
            <div className="space-y-5 px-6 py-5">

              {/* กระบวนการ */}
              <div>
                <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-slate-400">กระบวนการทำงาน</p>
                {/* Z-flow: A1→A2 ↓ A3←A4 */}
                <div className="space-y-1">
                  {/* Row 1: A1 → A2 */}
                  <div className="flex items-center gap-1.5">
                    {[
                      { step: "A1", label: "สร้าง PR", sub: "กรอกข้อมูล", color: "bg-amber-50 text-amber-700 border-amber-200" },
                      { step: "A2", label: "รออนุมัติ", sub: "หัวหน้าตรวจสอบ", color: "bg-blue-50 text-blue-700 border-blue-200" },
                    ].map((s, i) => (
                      <div key={s.step} className="flex flex-1 items-center gap-2.5">
                        <div className={`flex flex-1 items-center gap-2 rounded-xl border p-2.5 ${s.color}`}>
                          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/70 text-[10px] font-bold">{s.step}</span>
                          <div className="min-w-0">
                            <p className="text-xs font-bold leading-tight">{s.label}</p>
                            <p className="text-[10px] opacity-60 leading-tight">{s.sub}</p>
                          </div>
                        </div>
                        {i === 0 && <ChevronRight size={14} className="shrink-0 text-slate-300" />}
                      </div>
                    ))}
                  </div>

                  {/* ↓ connector อยู่ขวา (ใต้ A2) */}
                  <div className="flex">
                    <div className="flex-1" />
                    <div className="flex flex-1 justify-center py-0.5">
                      <ChevronDown size={14} className="text-slate-300" />
                    </div>
                  </div>

                  {/* Row 2: A4 ← A3 (Z-snake: A3 อยู่ขวาใต้ A2, A4 อยู่ซ้าย) */}
                  <div className="flex items-center gap-1.5">
                    {[
                      { step: "A4", label: "ตั้งจ่าย", sub: "การเงินดำเนินการ", color: "bg-violet-50 text-violet-700 border-violet-200" },
                      { step: "A3", label: "แนบบิล+รับของ", sub: "อัปโหลดหลักฐาน", color: "bg-emerald-50 text-emerald-700 border-emerald-200" },
                    ].map((s, i) => (
                      <div key={s.step} className="flex flex-1 items-center gap-2.5">
                        {i === 1 && <ChevronLeft size={14} className="shrink-0 text-slate-300" />}
                        <div className={`flex flex-1 items-center gap-2 rounded-xl border p-2.5 ${s.color}`}>
                          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/70 text-[10px] font-bold">{s.step}</span>
                          <div className="min-w-0">
                            <p className="text-xs font-bold leading-tight">{s.label}</p>
                            <p className="text-[10px] opacity-60 leading-tight">{s.sub}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* วิธีกรอก */}
              <div>
                <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-slate-400">วิธีกรอกข้อมูล</p>
                <div className="space-y-3">
                  {[
                    {
                      icon: CheckCircle2,
                      color: "text-emerald-500",
                      title: "หมวด",
                      desc: "เลือกหมวดของใบขอซื้อ ระบบจะกำหนดผู้อนุมัติให้อัตโนมัติ (หัวหน้าแผนก + ผู้ดูแลหมวดนั้น)",
                    },
                    {
                      icon: CheckCircle2,
                      color: "text-emerald-500",
                      title: "สาขา",
                      desc: "เลือกสาขาที่จะออกใบขอซื้อในนาม ระบบจะจำค่านี้ไว้สำหรับครั้งถัดไป",
                    },
                    {
                      icon: CheckCircle2,
                      color: "text-violet-500",
                      title: "กำหนดจ่ายเงิน",
                      desc: "บช. ตัดจ่ายทุกวันพุธและวันศุกร์ ระบบจะแสดงวันจ่ายถัดไปให้อัตโนมัติ",
                    },
                    {
                      icon: AlertCircle,
                      color: "text-amber-500",
                      title: "งานด่วน",
                      desc: "เปิดเฉพาะเมื่อต้องการเร่งด่วนจริงๆ เพื่อให้ผู้อนุมัติเห็นสัญลักษณ์ ⚡ ชัดเจน",
                    },
                    {
                      icon: CheckCircle2,
                      color: "text-emerald-500",
                      title: "รายการสินค้า",
                      desc: "เพิ่มสินค้าอย่างน้อย 1 รายการ ระบุชื่อสินค้า จำนวน หน่วย และราคาต่อหน่วยให้ครบ",
                    },
                    {
                      icon: CheckCircle2,
                      color: "text-emerald-500",
                      title: "เหตุผลในการสั่งซื้อ",
                      desc: "อธิบายความจำเป็นหรือที่มาของการสั่งซื้อ ช่วยให้ผู้อนุมัติตัดสินใจได้ง่ายขึ้น (ไม่บังคับ)",
                    },
                  ].map(item => (
                    <div key={item.title} className="flex gap-3">
                      <item.icon size={15} className={`mt-0.5 shrink-0 ${item.color}`} />
                      <div>
                        <p className="text-sm font-semibold text-slate-700">{item.title}</p>
                        <p className="text-xs leading-relaxed text-slate-500">{item.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* หลังบันทึก */}
              <div className="rounded-xl border border-blue-100 bg-blue-50 p-4">
                <div className="flex gap-2">
                  <Send size={14} className="mt-0.5 shrink-0 text-blue-500" />
                  <div>
                    <p className="text-sm font-semibold text-blue-700">หลังจากบันทึกร่างแล้ว</p>
                    <p className="mt-0.5 text-xs leading-relaxed text-blue-600">
                      PR จะถูกบันทึกเป็น &lsquo;ร่าง&rsquo; ก่อน คุณสามารถแก้ไขได้จนกว่าจะกด &lsquo;ส่งอนุมัติ&rsquo; ซึ่งจะส่งแจ้งเตือนไปยัง LINE ของผู้อนุมัติโดยอัตโนมัติ
                    </p>
                  </div>
                </div>
              </div>

              {/* หมายเหตุ */}
              <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                <div className="flex gap-2">
                  <Clock size={14} className="mt-0.5 shrink-0 text-slate-400" />
                  <p className="text-xs leading-relaxed text-slate-500">
                    เลขที่ PR จะถูกออกโดยอัตโนมัติในรูปแบบ <span className="font-mono font-semibold text-slate-700">PUR-YYMM-NNNN</span> หลังจากบันทึกสำเร็จ
                  </p>
                </div>
              </div>

            </div>

            {/* Footer */}
            <div className="border-t border-slate-100 px-6 py-4">
              <button
                onClick={() => setShowHelp(false)}
                className="w-full rounded-xl bg-blue-600 py-2.5 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
              >
                เข้าใจแล้ว เริ่มกรอกข้อมูล
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
