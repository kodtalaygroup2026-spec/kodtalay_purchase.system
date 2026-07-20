"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  ChevronDown,
  ChevronRight,
  Download,
  CheckCircle2,
  Eye,
  X,
  AlertCircle,
  Building2,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { logAudit } from "@/lib/supabase/audit";
import {
  generateKTBContent,
  validateKTBSettings,
  type KTBCompanySettings,
  type KTBRecipient,
} from "@/lib/utils/ktbFormat";
import { formatCurrency } from "@/lib/utils/format";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface PRWithEvidence {
  id: string;
  pr_number: string;
  title: string;
  total_amount: number;
  actual_amount: number | null;
  ktb_batch_ref: string | null;
  requester_name: string;
  branch_id: string | null;
  evidence_id: string | null;
  evidence_account_holder: string;
  evidence_account_number: string;
  evidence_bank_name: string;
  evidence_amount: number | null;
  evidence_ktb_branch: string;
}

export interface KTBBranch {
  id: string;
  code: string;
  name: string;
}

// ── สีประจำแต่ละบริษัท (keyed by branch code) ─────────────────────────────────
const BRANCH_THEME: Record<string, { active: string; badge: string }> = {
  CK:  { active: "border-red-500 text-red-600 bg-red-50",         badge: "bg-red-600 text-white" },
  BN:  { active: "border-blue-500 text-blue-600 bg-blue-50",      badge: "bg-blue-600 text-white" },
  RCA: { active: "border-emerald-500 text-emerald-600 bg-emerald-50", badge: "bg-emerald-600 text-white" },
};
const FALLBACK_BRANCH_THEME = { active: "border-slate-500 text-slate-700 bg-slate-50", badge: "bg-slate-600 text-white" };

interface EditedRow {
  recipientName: string;
  accountNumber: string;
  branchCode: string;
  rawAmount: string;
}

interface KTBTransferFormProps {
  branches: KTBBranch[];
  settingsByBranch: Record<string, Record<string, string>>;
  pendingPRs: PRWithEvidence[];
  currentUserId: string;
}

// แปลง settings row (snake_case) → KTBCompanySettings
function rowToSettings(row: Record<string, string> | undefined): KTBCompanySettings {
  return {
    payerAbbreviation: row?.payer_abbreviation ?? "",
    companyNameTH: row?.company_name_th ?? "",
    companyNameEN: row?.company_name_en ?? "",
    address: row?.address ?? "",
    province: row?.province ?? "",
    district: row?.district ?? "",
    subDistrict: row?.sub_district ?? "",
    postalCode: row?.postal_code ?? "",
    taxId: row?.tax_id ?? "",
    ktbCompanyId: row?.ktb_company_id ?? "",
    payerAccount: row?.payer_account ?? "",
  };
}

// ─── Settings Section ────────────────────────────────────────────────────────

function SettingsSection({
  settings,
  isSaved,
  companyName,
  onSave,
  onChange,
}: {
  settings: KTBCompanySettings;
  isSaved: boolean;
  companyName?: string;
  onSave: () => Promise<void>;
  onChange: (key: keyof KTBCompanySettings, value: string) => void;
}) {
  const [open, setOpen] = useState(!isSaved);
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    await onSave();
    setSaving(false);
    setOpen(false);
  }

  const field = (
    label: string,
    key: keyof KTBCompanySettings,
    placeholder?: string,
    hint?: string
  ) => (
    <div>
      <label className="block text-xs font-medium text-slate-600 mb-1">
        {label}
        {hint && <span className="ml-1 text-slate-400 font-normal">{hint}</span>}
      </label>
      <input
        type="text"
        value={settings[key]}
        onChange={(e) => onChange(key, e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
      />
    </div>
  );

  return (
    <div className="rounded-xl border border-slate-200 bg-white">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-3 px-5 py-4 text-left"
      >
        <Building2 size={18} className="text-slate-500 shrink-0" />
        <div className="flex-1">
          <p className="text-sm font-semibold text-slate-800">
            ข้อมูลบริษัท (KTB Settings){companyName ? ` — ${companyName}` : ""}
          </p>
          {isSaved && !open && (
            <p className="text-xs text-slate-500 mt-0.5">
              {settings.companyNameTH} — {settings.payerAccount}
            </p>
          )}
        </div>
        {isSaved && (
          <span className="flex items-center gap-1 text-xs text-green-600 font-medium mr-2">
            <CheckCircle2 size={14} /> บันทึกแล้ว
          </span>
        )}
        {open ? <ChevronDown size={16} className="text-slate-400 shrink-0" /> : <ChevronRight size={16} className="text-slate-400 shrink-0" />}
      </button>

      {open && (
        <div className="border-t border-slate-100 px-5 py-4 space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {field("ชื่อย่อ (Payer Abbr)", "payerAbbreviation", "เช่น MYCO", "(≤ 10 ตัว)")}
            {field("ชื่อบริษัท (ไทย)", "companyNameTH", "บริษัท ตัวอย่าง จำกัด")}
            {field("ชื่อบริษัท (อังกฤษ)", "companyNameEN", "Example Co., Ltd.")}
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {field("ที่อยู่", "address", "123 ถ.สุขุมวิท")}
            {field("จังหวัด", "province", "Bangkok")}
            {field("อำเภอ/เขต", "district", "Watthana")}
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {field("ตำบล/แขวง", "subDistrict", "Khlongtoei")}
            {field("รหัสไปรษณีย์", "postalCode", "10110")}
            {field("เลขประจำตัวผู้เสียภาษี", "taxId", "0105500000000", "(13 หลัก)")}
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {field("Company ID (KTB Smart Biz)", "ktbCompanyId", "เช่น SITBA00030")}
            {field("เลขบัญชีต้นทาง (KTB)", "payerAccount", "เช่น 5010308495", "(10 หลัก)")}
          </div>

          <div className="flex justify-end pt-1">
            <button
              onClick={handleSave}
              disabled={saving}
              className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-medium text-white transition hover:bg-blue-700 disabled:opacity-60"
            >
              {saving ? "กำลังบันทึก…" : "บันทึกการตั้งค่า"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Preview Modal ────────────────────────────────────────────────────────────

function PreviewModal({
  content,
  filename,
  onClose,
}: {
  content: string;
  filename: string;
  onClose: () => void;
}) {
  function handleDownload() {
    const blob = new Blob(["﻿" + content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="relative w-full max-w-4xl rounded-2xl bg-white shadow-2xl flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 shrink-0">
          <div>
            <p className="font-semibold text-slate-800">ตัวอย่างไฟล์ KTB</p>
            <p className="text-xs text-slate-500 mt-0.5">{filename}</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleDownload}
              className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              <Download size={15} />
              ดาวน์โหลด
            </button>
            <button
              onClick={onClose}
              className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            >
              <X size={18} />
            </button>
          </div>
        </div>
        <pre className="overflow-auto p-5 text-xs text-slate-700 font-mono leading-5 bg-slate-50 rounded-b-2xl flex-1">
          {content}
        </pre>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function KTBTransferForm({ branches, settingsByBranch, pendingPRs, currentUserId }: KTBTransferFormProps) {
  const router = useRouter();
  const supabase = createClient();

  // ── บริษัทที่กำลังเลือก (ค่าเริ่มต้น: บริษัทแรกที่มีรายการรอชำระ) ──
  const [selectedBranchId, setSelectedBranchId] = useState<string>(() => {
    const withPRs = branches.find((b) => pendingPRs.some((p) => p.branch_id === b.id));
    return withPRs?.id ?? branches[0]?.id ?? "";
  });

  // ── Settings state (แยกตามบริษัท) ──
  const [settingsMap, setSettingsMap] = useState<Record<string, KTBCompanySettings>>(() => {
    const m: Record<string, KTBCompanySettings> = {};
    branches.forEach((b) => { m[b.id] = rowToSettings(settingsByBranch[b.id]); });
    return m;
  });
  const [settingsIdMap, setSettingsIdMap] = useState<Record<string, string | null>>(() => {
    const m: Record<string, string | null> = {};
    branches.forEach((b) => { m[b.id] = settingsByBranch[b.id]?.id ?? null; });
    return m;
  });
  const [settingsSavedMap, setSettingsSavedMap] = useState<Record<string, boolean>>(() => {
    const m: Record<string, boolean> = {};
    branches.forEach((b) => { m[b.id] = !!settingsByBranch[b.id]; });
    return m;
  });

  const settings = settingsMap[selectedBranchId] ?? rowToSettings(undefined);
  const settingsSaved = settingsSavedMap[selectedBranchId] ?? false;
  const selectedBranch = branches.find((b) => b.id === selectedBranchId) ?? null;

  // รายการ PR เฉพาะบริษัทที่เลือก
  const filteredPRs = pendingPRs.filter((pr) => pr.branch_id === selectedBranchId);

  // ── Batch state ──
  const todayStr = new Date().toISOString().slice(0, 10);
  const [batchNo, setBatchNo] = useState("000001");
  const [customerRefNo, setCustomerRefNo] = useState(
    `REF-${todayStr.replace(/-/g, "")}-01`
  );
  const [effectiveDate, setEffectiveDate] = useState(todayStr);

  // ── PR row edit state ──
  const [editedRows, setEditedRows] = useState<Record<string, EditedRow>>(() => {
    const init: Record<string, EditedRow> = {};
    pendingPRs.forEach((pr) => {
      init[pr.id] = {
        recipientName: pr.evidence_account_holder,
        accountNumber: pr.evidence_account_number,
        branchCode: pr.evidence_ktb_branch,
        rawAmount: String(
          pr.evidence_amount ?? pr.actual_amount ?? pr.total_amount ?? 0
        ),
      };
    });
    return init;
  });

  const [selected, setSelected] = useState<Set<string>>(new Set());

  // ── Preview state ──
  const [previewContent, setPreviewContent] = useState("");
  const [previewFilename, setPreviewFilename] = useState("");
  const [showPreview, setShowPreview] = useState(false);

  // ── Action state ──
  const [isMarkingPaid, setIsMarkingPaid] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [successMsg, setSuccessMsg] = useState("");

  // ─── Handlers ───────────────────────────────────────────────────────────────

  function updateSettings(key: keyof KTBCompanySettings, value: string) {
    setSettingsMap((m) => ({
      ...m,
      [selectedBranchId]: { ...m[selectedBranchId], [key]: value },
    }));
    setSettingsSavedMap((m) => ({ ...m, [selectedBranchId]: false }));
  }

  async function saveSettings() {
    const s = settingsMap[selectedBranchId];
    const payload = {
      branch_id: selectedBranchId,
      payer_abbreviation: s.payerAbbreviation,
      company_name_th: s.companyNameTH,
      company_name_en: s.companyNameEN,
      address: s.address,
      province: s.province,
      district: s.district,
      sub_district: s.subDistrict,
      postal_code: s.postalCode,
      tax_id: s.taxId,
      ktb_company_id: s.ktbCompanyId,
      payer_account: s.payerAccount,
      updated_at: new Date().toISOString(),
    };

    const existingId = settingsIdMap[selectedBranchId];
    if (existingId) {
      await supabase
        .from("company_ktb_settings" as any)
        .update(payload)
        .eq("id", existingId);
    } else {
      const { data } = await supabase
        .from("company_ktb_settings" as any)
        .insert(payload)
        .select("id")
        .single();
      if (data) {
        setSettingsIdMap((m) => ({ ...m, [selectedBranchId]: (data as any).id }));
      }
    }
    setSettingsSavedMap((m) => ({ ...m, [selectedBranchId]: true }));
  }

  // สลับบริษัท — เคลียร์รายการที่เลือกไว้ (batch ต้องเป็นบริษัทเดียว)
  function switchCompany(branchId: string) {
    if (branchId === selectedBranchId) return;
    setSelectedBranchId(branchId);
    setSelected(new Set());
    setErrors([]);
    setSuccessMsg("");
  }

  function updateRow(prId: string, field: keyof EditedRow, value: string) {
    setEditedRows((prev) => ({
      ...prev,
      [prId]: { ...prev[prId], [field]: value },
    }));
  }

  function toggleSelect(prId: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(prId)) next.delete(prId);
      else next.add(prId);
      return next;
    });
  }

  function toggleSelectAll() {
    const selectableIds = filteredPRs.filter((p) => !p.ktb_batch_ref).map((p) => p.id);
    const allSelected = selectableIds.length > 0 && selectableIds.every((id) => selected.has(id));
    if (allSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(selectableIds));
    }
  }

  const buildRecipients = useCallback((): KTBRecipient[] => {
    return pendingPRs
      .filter((pr) => selected.has(pr.id))
      .map((pr, idx) => {
        const row = editedRows[pr.id];
        return {
          seqNo: idx + 1,
          name: row.recipientName,
          accountNumber: row.accountNumber,
          branchCode: row.branchCode,
          amount: parseFloat(row.rawAmount) || 0,
        };
      });
  }, [pendingPRs, selected, editedRows]);

  function validate(): string[] {
    const errs: string[] = [];
    const settingErrors = validateKTBSettings(settings);
    if (settingErrors.length > 0) {
      errs.push(`กรุณากรอกข้อมูลบริษัท: ${settingErrors.join(", ")}`);
    }
    if (selected.size === 0) {
      errs.push("กรุณาเลือก PR อย่างน้อย 1 รายการ");
    }
    if (!batchNo || batchNo.trim() === "") {
      errs.push("กรุณากรอก Batch No");
    }
    const recipients = buildRecipients();
    recipients.forEach((r, i) => {
      const pr = pendingPRs.filter((p) => selected.has(p.id))[i];
      if (!r.accountNumber || r.accountNumber.replace(/\D/g, "").length !== 10) {
        errs.push(`${pr?.pr_number}: เลขบัญชี KTB ต้องมี 10 หลัก`);
      }
      if (!r.branchCode || r.branchCode.trim().length < 3) {
        errs.push(`${pr?.pr_number}: กรุณากรอกรหัสสาขา KTB`);
      }
      if (r.amount <= 0) {
        errs.push(`${pr?.pr_number}: ยอดโอนต้องมากกว่า 0`);
      }
    });
    return errs;
  }

  function handlePreview() {
    const errs = validate();
    if (errs.length > 0) {
      setErrors(errs);
      return;
    }
    setErrors([]);
    const recipients = buildRecipients();
    const content = generateKTBContent(settings, recipients, {
      batchNo,
      customerRefNo,
      effectiveDate,
    });
    const date = effectiveDate.replace(/-/g, "");
    setPreviewContent(content);
    setPreviewFilename(`KTB_3RD_${date}_${batchNo.padStart(6, "0")}.txt`);
    setShowPreview(true);
  }

  async function handleMarkPaid() {
    const errs = validate();
    if (errs.length > 0) {
      setErrors(errs);
      return;
    }
    setErrors([]);
    setIsMarkingPaid(true);
    try {
      const paddedBatch = batchNo.padStart(6, "0");
      const ids = Array.from(selected);
      const { error } = await (supabase as any)
        .from("purchase_requisitions")
        .update({
          status: "paid",
          ktb_batch_ref: paddedBatch,
          finance_action_at: new Date().toISOString(),
        })
        .in("id", ids);
      if (error) throw error;
      logAudit({
        actorId: currentUserId,
        action: "ktb_batch_paid",
        entity: "purchase_requisitions",
        metadata: {
          batch_ref: paddedBatch,
          pr_ids: ids,
          pr_count: ids.length,
          total_amount: selectedTotal,
        },
      });
      setSuccessMsg(
        `บันทึกชำระแล้ว ${ids.length} รายการ (Batch: ${paddedBatch})`
      );
      setSelected(new Set());
      router.refresh();
    } catch (err: any) {
      setErrors([err?.message ?? "เกิดข้อผิดพลาด"]);
    } finally {
      setIsMarkingPaid(false);
    }
  }

  // ─── Selected summary ────────────────────────────────────────────────────────

  const selectedTotal = pendingPRs
    .filter((pr) => selected.has(pr.id))
    .reduce((sum, pr) => {
      const row = editedRows[pr.id];
      return sum + (parseFloat(row?.rawAmount) || 0);
    }, 0);

  // ─── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-5">
      {/* Company selector tabs */}
      {branches.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {branches.map((b) => {
            const theme = BRANCH_THEME[b.code] ?? FALLBACK_BRANCH_THEME;
            const isActive = b.id === selectedBranchId;
            const count = pendingPRs.filter((p) => p.branch_id === b.id).length;
            return (
              <button
                key={b.id}
                onClick={() => switchCompany(b.id)}
                className={`flex items-center gap-2 rounded-lg border-2 px-4 py-2 text-sm font-semibold transition ${
                  isActive
                    ? theme.active
                    : "border-slate-200 bg-white text-slate-500 hover:border-slate-300"
                }`}
              >
                <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${theme.badge}`}>
                  {b.code}
                </span>
                {b.name}
                {count > 0 && (
                  <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-amber-500 px-1.5 text-[10px] font-bold text-white">
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* Settings — key ทำให้ remount เมื่อสลับบริษัท (reset open state) */}
      <SettingsSection
        key={selectedBranchId}
        settings={settings}
        isSaved={settingsSaved}
        companyName={selectedBranch?.name}
        onSave={saveSettings}
        onChange={updateSettings}
      />

      {/* Batch info */}
      <div className="rounded-xl border border-slate-200 bg-white px-5 py-4">
        <p className="text-sm font-semibold text-slate-800 mb-4">ข้อมูล Batch</p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Batch No <span className="text-slate-400 font-normal">(6 หลัก)</span>
            </label>
            <input
              type="text"
              value={batchNo}
              onChange={(e) => setBatchNo(e.target.value.replace(/\D/g, "").slice(0, 6))}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none font-mono"
              placeholder="000001"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Customer Ref No
            </label>
            <input
              type="text"
              value={customerRefNo}
              onChange={(e) => setCustomerRefNo(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              วันที่โอน (Effective Date)
            </label>
            <input
              type="date"
              value={effectiveDate}
              onChange={(e) => setEffectiveDate(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            />
          </div>
        </div>
      </div>

      {/* PR selection table */}
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <p className="text-sm font-semibold text-slate-800">
            รายการรอชำระ{selectedBranch ? ` — ${selectedBranch.name}` : ""} ({filteredPRs.length} รายการ)
          </p>
          {selected.size > 0 && (
            <span className="text-sm text-blue-600 font-medium">
              เลือก {selected.size} รายการ — ยอดรวม {formatCurrency(selectedTotal)}
            </span>
          )}
        </div>

        {filteredPRs.length === 0 ? (
          <div className="py-12 text-center text-slate-400 text-sm">
            ไม่มีรายการที่รอชำระของบริษัทนี้
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50 text-xs text-slate-500">
                  <th className="px-4 py-3 text-left w-10">
                    <input
                      type="checkbox"
                      checked={
                        filteredPRs.filter((p) => !p.ktb_batch_ref).length > 0 &&
                        filteredPRs
                          .filter((p) => !p.ktb_batch_ref)
                          .every((p) => selected.has(p.id))
                      }
                      onChange={toggleSelectAll}
                      className="rounded"
                    />
                  </th>
                  <th className="px-4 py-3 text-left whitespace-nowrap">PR #</th>
                  <th className="px-4 py-3 text-left">ผู้ยื่นขอ</th>
                  <th className="px-4 py-3 text-left min-w-[160px]">ชื่อผู้รับเงิน</th>
                  <th className="px-4 py-3 text-left min-w-[140px]">เลขบัญชี KTB</th>
                  <th className="px-4 py-3 text-left min-w-[100px]">รหัสสาขา</th>
                  <th className="px-4 py-3 text-right min-w-[120px]">ยอดโอน (บาท)</th>
                  <th className="px-4 py-3 text-left">KTB Batch</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredPRs.map((pr) => {
                  const row = editedRows[pr.id];
                  const isSelected = selected.has(pr.id);
                  const alreadyExported = !!pr.ktb_batch_ref;

                  return (
                    <tr
                      key={pr.id}
                      className={`transition-colors ${
                        isSelected ? "bg-blue-50/50" : "hover:bg-slate-50/50"
                      } ${alreadyExported ? "opacity-60" : ""}`}
                    >
                      <td className="px-4 py-2.5">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelect(pr.id)}
                          className="rounded"
                          disabled={alreadyExported}
                        />
                      </td>
                      <td className="px-4 py-2.5 whitespace-nowrap">
                        <p className="font-mono text-xs font-semibold text-slate-800">
                          {pr.pr_number}
                        </p>
                        <p className="text-xs text-slate-400 truncate max-w-[100px]" title={pr.title}>
                          {pr.title}
                        </p>
                      </td>
                      <td className="px-4 py-2.5 text-xs text-slate-600 whitespace-nowrap">
                        {pr.requester_name || "—"}
                      </td>

                      {/* ชื่อผู้รับเงิน — editable */}
                      <td className="px-4 py-2.5">
                        <input
                          type="text"
                          value={row.recipientName}
                          onChange={(e) =>
                            updateRow(pr.id, "recipientName", e.target.value)
                          }
                          disabled={alreadyExported}
                          className="w-full rounded border border-slate-200 px-2 py-1 text-xs focus:border-blue-500 focus:outline-none disabled:bg-transparent disabled:border-transparent"
                        />
                      </td>

                      {/* เลขบัญชี KTB — editable */}
                      <td className="px-4 py-2.5">
                        <input
                          type="text"
                          inputMode="numeric"
                          value={row.accountNumber}
                          onChange={(e) =>
                            updateRow(
                              pr.id,
                              "accountNumber",
                              e.target.value.replace(/\D/g, "").slice(0, 10)
                            )
                          }
                          disabled={alreadyExported}
                          placeholder="0000000000"
                          className={`w-full rounded border px-2 py-1 text-xs font-mono focus:border-blue-500 focus:outline-none disabled:bg-transparent disabled:border-transparent ${
                            row.accountNumber.length > 0 &&
                            row.accountNumber.length !== 10
                              ? "border-red-300 bg-red-50"
                              : "border-slate-200"
                          }`}
                        />
                      </td>

                      {/* รหัสสาขา — editable */}
                      <td className="px-4 py-2.5">
                        <input
                          type="text"
                          inputMode="numeric"
                          value={row.branchCode}
                          onChange={(e) =>
                            updateRow(
                              pr.id,
                              "branchCode",
                              e.target.value.replace(/\D/g, "").slice(0, 4)
                            )
                          }
                          disabled={alreadyExported}
                          placeholder="0000"
                          className="w-full rounded border border-slate-200 px-2 py-1 text-xs font-mono focus:border-blue-500 focus:outline-none disabled:bg-transparent disabled:border-transparent"
                        />
                      </td>

                      {/* ยอดโอน — editable */}
                      <td className="px-4 py-2.5">
                        <input
                          type="text"
                          inputMode="decimal"
                          value={row.rawAmount}
                          onChange={(e) =>
                            updateRow(pr.id, "rawAmount", e.target.value)
                          }
                          disabled={alreadyExported}
                          className="w-full rounded border border-slate-200 px-2 py-1 text-xs text-right font-mono focus:border-blue-500 focus:outline-none disabled:bg-transparent disabled:border-transparent"
                        />
                      </td>

                      <td className="px-4 py-2.5 text-xs whitespace-nowrap">
                        {alreadyExported ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-green-700 text-xs font-medium">
                            <CheckCircle2 size={11} />
                            {pr.ktb_batch_ref}
                          </span>
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Error messages */}
      {errors.length > 0 && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3">
          <div className="flex items-start gap-2">
            <AlertCircle size={16} className="text-red-500 mt-0.5 shrink-0" />
            <ul className="text-sm text-red-700 space-y-0.5">
              {errors.map((e, i) => (
                <li key={i}>{e}</li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* Success message */}
      {successMsg && (
        <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 flex items-center gap-2">
          <CheckCircle2 size={16} className="text-green-600 shrink-0" />
          <p className="text-sm text-green-700 font-medium">{successMsg}</p>
        </div>
      )}

      {/* Action bar */}
      <div className="flex flex-wrap items-center gap-3 justify-end pb-2">
        <span className="text-sm text-slate-500 mr-auto">
          {selected.size > 0
            ? `เลือก ${selected.size} รายการ — ยอดรวม ${formatCurrency(selectedTotal)}`
            : "ยังไม่ได้เลือกรายการ"}
        </span>
        <button
          onClick={handlePreview}
          disabled={selected.size === 0}
          className="flex items-center gap-2 rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-40"
        >
          <Eye size={15} />
          ดูตัวอย่างไฟล์
        </button>
        <button
          onClick={handleMarkPaid}
          disabled={selected.size === 0 || isMarkingPaid}
          className="flex items-center gap-2 rounded-lg bg-green-600 px-5 py-2 text-sm font-medium text-white transition hover:bg-green-700 disabled:opacity-40"
        >
          <CheckCircle2 size={15} />
          {isMarkingPaid ? "กำลังบันทึก…" : "บันทึกว่าชำระแล้ว"}
        </button>
      </div>

      {/* Preview modal */}
      {showPreview && (
        <PreviewModal
          content={previewContent}
          filename={previewFilename}
          onClose={() => setShowPreview(false)}
        />
      )}
    </div>
  );
}
