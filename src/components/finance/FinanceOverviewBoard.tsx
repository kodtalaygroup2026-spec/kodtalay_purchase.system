"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { formatCurrency, formatDate } from "@/lib/utils/format";
import { Building2, Inbox, X, Download, Eye, CheckSquare, Square, AlertCircle, Search } from "lucide-react";
import {
  generateKTBContent, validateKTBSettings,
  type KTBCompanySettings, type KTBRecipient,
} from "@/lib/utils/ktbFormat";
import { KTB_ENABLED } from "@/lib/config/features";

// ── สีประจำแต่ละบริษัท (keyed by branch code) ─────────────────────────────────
const COMPANY_THEME: Record<
  string,
  { bar: string; iconBg: string; iconText: string; badge: string; amount: string; ring: string; activeBg: string }
> = {
  CK:  { bar: "bg-red-500",     iconBg: "bg-red-50",     iconText: "text-red-500",     badge: "bg-red-600 text-white",     amount: "text-red-600",     ring: "ring-red-400",     activeBg: "bg-red-50/40" },
  BN:  { bar: "bg-blue-500",    iconBg: "bg-blue-50",    iconText: "text-blue-500",    badge: "bg-blue-600 text-white",    amount: "text-blue-600",    ring: "ring-blue-400",    activeBg: "bg-blue-50/40" },
  RCA: { bar: "bg-emerald-500", iconBg: "bg-emerald-50", iconText: "text-emerald-500", badge: "bg-emerald-600 text-white", amount: "text-emerald-600", ring: "ring-emerald-400", activeBg: "bg-emerald-50/40" },
};

const FALLBACK_THEME = {
  bar: "bg-slate-400", iconBg: "bg-slate-50", iconText: "text-slate-500",
  badge: "bg-slate-600 text-white", amount: "text-slate-700", ring: "ring-slate-400", activeBg: "bg-slate-50",
};

function themeFor(code: string) {
  return COMPANY_THEME[code] ?? FALLBACK_THEME;
}

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

/** สถานะของใบสั่งซื้อในมุมของฝ่ายการเงิน */
export type FinanceRowStatus =
  | "pending_verify"  // ส่งหลักฐานแล้ว รอ บช. ตรวจสอบ
  | "pending_pay"     // ตรวจสอบแล้ว รอจ่าย
  | "paid"            // จ่ายแล้ว
  | "returned"        // ตีกลับให้แก้ไข
  | "cancelled";      // ยกเลิก

const STATUS_META: Record<FinanceRowStatus, { label: string; badge: string; dot: string }> = {
  pending_verify: { label: "รอตรวจสอบ", badge: "bg-amber-50 text-amber-700 border-amber-200",   dot: "bg-amber-400" },
  pending_pay:    { label: "รอจ่าย",    badge: "bg-blue-50 text-blue-700 border-blue-200",      dot: "bg-blue-500" },
  paid:           { label: "จ่ายแล้ว",  badge: "bg-green-50 text-green-700 border-green-200",   dot: "bg-green-500" },
  returned:       { label: "ตีกลับ",    badge: "bg-orange-50 text-orange-700 border-orange-200", dot: "bg-orange-400" },
  cancelled:      { label: "ยกเลิก",    badge: "bg-red-50 text-red-700 border-red-200",         dot: "bg-red-500" },
};

const STATUS_ORDER: FinanceRowStatus[] = ["pending_verify", "pending_pay", "paid", "returned", "cancelled"];

type SortKey = "date_desc" | "date_asc" | "amount_desc" | "amount_asc" | "pr_number";

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: "date_desc",   label: "วันที่ล่าสุดก่อน" },
  { value: "date_asc",    label: "วันที่เก่าสุดก่อน" },
  { value: "amount_desc", label: "ยอดเงินมาก → น้อย" },
  { value: "amount_asc",  label: "ยอดเงินน้อย → มาก" },
  { value: "pr_number",   label: "เลขที่ PR" },
];

export interface FinancePR {
  id: string;
  pr_number: string;
  title: string;
  amount: number;
  requester_name: string;
  branch_code: string;
  branch_name: string;
  status: FinanceRowStatus;
  /** ช่องทางจ่ายที่ บช. เลือกตอนตรวจสอบ */
  channel: "company" | "petty_cash" | null;
  /** วันที่ล่าสุดของรายการ (จ่าย/ตรวจสอบ/ส่งหลักฐาน) */
  date: string | null;
  paid_at?: string | null;
  account_holder_name?: string;
  bank_account_number?: string;
  ktb_branch_code?: string;
}

export interface FinanceCompany {
  id: string;
  code: string;
  name: string;
  /** จำนวนรายการทั้งหมดที่ส่งมายังการเงิน */
  count: number;
  /** ยอดรวมทั้งหมด */
  total: number;
  /** รอจ่าย (ตรวจสอบแล้ว) */
  pendingCount: number;
  pendingTotal: number;
  paidCount: number;
}

interface FinanceOverviewBoardProps {
  companies: FinanceCompany[];
  prs: FinancePR[];
  settingsByBranch: Record<string, Record<string, string>>;
}

export function FinanceOverviewBoard({ companies, prs, settingsByBranch }: FinanceOverviewBoardProps) {
  // null = แสดงทั้งหมด (ค่าเริ่มต้น)
  const [selectedCode, setSelectedCode] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<FinanceRowStatus | "all">("all");
  const [channelFilter, setChannelFilter] = useState<"all" | "company" | "petty_cash">("all");
  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("date_desc");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [batchNo, setBatchNo] = useState("000001");
  const [effectiveDate, setEffectiveDate] = useState(new Date().toISOString().slice(0, 10));
  const [showReport, setShowReport] = useState(false);

  // กรองด้วยบริษัทก่อน เพื่อให้ตัวเลขบนชิปสถานะสะท้อนบริษัทที่กำลังดู
  const companyPRs = useMemo(
    () => (selectedCode ? prs.filter((pr) => pr.branch_code === selectedCode) : prs),
    [prs, selectedCode]
  );

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { all: companyPRs.length };
    for (const s of STATUS_ORDER) counts[s] = 0;
    for (const pr of companyPRs) counts[pr.status]++;
    return counts;
  }, [companyPRs]);

  const visiblePRs = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    const rows = companyPRs.filter((pr) => {
      if (statusFilter !== "all" && pr.status !== statusFilter) return false;
      if (channelFilter !== "all" && pr.channel !== channelFilter) return false;
      if (!keyword) return true;
      return (
        pr.pr_number.toLowerCase().includes(keyword) ||
        pr.title.toLowerCase().includes(keyword) ||
        pr.requester_name.toLowerCase().includes(keyword) ||
        (pr.account_holder_name ?? "").toLowerCase().includes(keyword)
      );
    });

    const timeOf = (pr: FinancePR) => (pr.date ? new Date(pr.date).getTime() : 0);
    const sorted = [...rows];
    switch (sortKey) {
      case "date_asc":    sorted.sort((a, b) => timeOf(a) - timeOf(b)); break;
      case "amount_desc": sorted.sort((a, b) => Number(b.amount) - Number(a.amount)); break;
      case "amount_asc":  sorted.sort((a, b) => Number(a.amount) - Number(b.amount)); break;
      case "pr_number":   sorted.sort((a, b) => a.pr_number.localeCompare(b.pr_number)); break;
      default:            sorted.sort((a, b) => timeOf(b) - timeOf(a));
    }
    return sorted;
  }, [companyPRs, statusFilter, channelFilter, query, sortKey]);

  const visibleTotal = visiblePRs.reduce((sum, pr) => sum + Number(pr.amount), 0);
  const isFiltered = statusFilter !== "all" || channelFilter !== "all" || query.trim() !== "";

  const selectedCompany = companies.find((c) => c.code === selectedCode) ?? null;
  const selectedRows = visiblePRs.filter((p) => selected.has(p.id));

  function handleCardClick(code: string) {
    setSelectedCode((prev) => (prev === code ? null : code));
    setSelected(new Set());
  }

  function resetFilters() {
    setStatusFilter("all");
    setChannelFilter("all");
    setQuery("");
    setSortKey("date_desc");
  }

  // ── การเลือกแถว ───────────────────────────────────────────────────────────
  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  function toggleAll() {
    const ids = visiblePRs.map((p) => p.id);
    const allSel = ids.length > 0 && ids.every((id) => selected.has(id));
    setSelected(allSel ? new Set() : new Set(ids));
  }
  const allSelected = visiblePRs.length > 0 && visiblePRs.every((p) => selected.has(p.id));

  // ── สร้างไฟล์ KTB จากรายการที่เลือก ──────────────────────────────────────────
  function buildKTB(): { content: string | null; filename: string; errors: string[] } {
    const rows = selectedRows;
    if (rows.length === 0) return { content: null, filename: "", errors: ["กรุณาเลือกรายการอย่างน้อย 1 รายการ"] };

    // ต้องเป็นบริษัทเดียว (ไฟล์ 1 ชุด = 1 บริษัทผู้จ่าย)
    const codes = [...new Set(rows.map((r) => r.branch_code))];
    if (codes.length > 1) {
      return { content: null, filename: "", errors: ["ไฟล์ KTB สร้างได้ทีละบริษัท — กรุณาเลือกบริษัทเดียว (คลิกการ์ดบริษัทด้านบนเพื่อกรอง)"] };
    }

    const company = companies.find((c) => c.code === codes[0]);
    const settings = rowToSettings(company ? settingsByBranch[company.id] : undefined);
    const settingErrors = validateKTBSettings(settings);
    if (settingErrors.length > 0) {
      return { content: null, filename: "", errors: [`ตั้งค่าบริษัทยังไม่ครบ: ${settingErrors.join(", ")} — ตั้งค่าที่หน้า KTB Smart Transfer`] };
    }

    const rowErrors: string[] = [];
    rows.forEach((r) => {
      const acct = (r.bank_account_number ?? "").replace(/\D/g, "");
      if (acct.length !== 10) rowErrors.push(`${r.pr_number}: เลขบัญชี KTB ต้อง 10 หลัก`);
      if (!r.ktb_branch_code || r.ktb_branch_code.trim().length < 3) rowErrors.push(`${r.pr_number}: ขาดรหัสสาขา KTB`);
      if (Number(r.amount) <= 0) rowErrors.push(`${r.pr_number}: ยอดต้องมากกว่า 0`);
    });
    if (rowErrors.length > 0) return { content: null, filename: "", errors: rowErrors };

    const recipients: KTBRecipient[] = rows.map((r, idx) => ({
      seqNo: idx + 1,
      name: r.account_holder_name ?? "",
      accountNumber: (r.bank_account_number ?? "").replace(/\D/g, ""),
      branchCode: r.ktb_branch_code ?? "",
      amount: Number(r.amount),
    }));

    const content = generateKTBContent(settings, recipients, {
      batchNo,
      customerRefNo: `REF-${effectiveDate.replace(/-/g, "")}-01`,
      effectiveDate,
    });
    const date = effectiveDate.replace(/-/g, "");
    const filename = `KTB_3RD_${date}_${batchNo.padStart(6, "0")}.txt`;
    return { content, filename, errors: [] };
  }

  function downloadKTB() {
    const { content, filename } = buildKTB();
    if (!content) {
      setShowReport(true); // เปิด modal เพื่อโชว์ error
      return;
    }
    const blob = new Blob(["﻿" + content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  const report = showReport ? buildKTB() : null;

  return (
    <div className="space-y-5">
      {/* ── การ์ดบริษัท (ปุ่มกรอง) ─────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {companies.map((company) => {
          const theme = themeFor(company.code);
          const isActive = selectedCode === company.code;

          return (
            <button
              key={company.code}
              onClick={() => handleCardClick(company.code)}
              className={`group flex flex-col overflow-hidden rounded-xl border bg-white text-left shadow-sm transition ${
                isActive
                  ? `border-transparent ring-2 ${theme.ring} shadow-md ${theme.activeBg}`
                  : "border-slate-200 hover:border-slate-300 hover:shadow-md"
              }`}
            >
              <div className={`h-1 ${theme.bar}`} />
              <div className="flex flex-1 flex-col p-5">
                <div className="flex items-center gap-3">
                  <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${theme.iconBg}`}>
                    <Building2 size={22} className={theme.iconText} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-bold text-slate-800">{company.name}</p>
                    <span className={`mt-0.5 inline-block rounded px-1.5 py-0.5 text-[10px] font-bold ${theme.badge}`}>
                      {company.code}
                    </span>
                  </div>
                  {isActive && (
                    <span className="rounded-full bg-slate-900/5 px-2 py-0.5 text-[10px] font-semibold text-slate-500">
                      ● กำลังดู
                    </span>
                  )}
                </div>

                <div className="mt-4 flex items-end justify-between">
                  <div>
                    <p className="text-3xl font-bold leading-none text-slate-800">{company.count}</p>
                    <p className="mt-1 text-xs text-slate-400">รายการทั้งหมด</p>
                  </div>
                  <div className="text-right">
                    <p className={`text-lg font-bold leading-none ${theme.amount}`}>
                      {formatCurrency(company.total)}
                    </p>
                    <p className="mt-1 text-xs text-slate-400">ยอดรวม</p>
                  </div>
                </div>

                <div className="mt-3 flex items-center gap-3 border-t border-slate-100 pt-2.5 text-[11px]">
                  <span className="flex items-center gap-1 text-slate-500">
                    <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />
                    รอจ่าย {company.pendingCount} · {formatCurrency(company.pendingTotal)}
                  </span>
                  <span className="ml-auto flex items-center gap-1 text-slate-500">
                    <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
                    จ่ายแล้ว {company.paidCount}
                  </span>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* ── ตารางรายการทั้งหมด ───────────────────────────────────────────────── */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        {/* หัวตาราง */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 bg-slate-50 px-4 py-3">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold text-slate-700">
              {selectedCompany ? `รายการทั้งหมด — ${selectedCompany.name}` : "รายการทั้งหมด"}
            </h2>
            <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[11px] font-medium text-slate-600">
              {visiblePRs.length} รายการ · {formatCurrency(visibleTotal)}
            </span>
          </div>
          {selectedCode && (
            <button
              onClick={() => { setSelectedCode(null); setSelected(new Set()); }}
              className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-slate-500 transition hover:bg-slate-200 hover:text-slate-700"
            >
              <X size={12} /> ทุกบริษัท
            </button>
          )}
        </div>

        {/* ── ค้นหา + เรียงลำดับ ────────────────────────────────────────────── */}
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 px-4 py-3">
          <div className="relative min-w-[220px] flex-1">
            <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="ค้นหาเลขที่ PR / ชื่อรายการ / ผู้ขอ / ชื่อบัญชี"
              className="w-full rounded-lg border border-slate-300 py-2 pl-9 pr-3 text-sm placeholder:text-slate-400 focus:border-blue-500 focus:outline-none"
            />
          </div>

          <select
            value={channelFilter}
            onChange={(e) => setChannelFilter(e.target.value as typeof channelFilter)}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 focus:border-blue-500 focus:outline-none"
          >
            <option value="all">ทุกช่องทาง</option>
            <option value="company">บริษัทสั่งจ่าย</option>
            <option value="petty_cash">เงินสดย่อย</option>
          </select>

          <select
            value={sortKey}
            onChange={(e) => setSortKey(e.target.value as SortKey)}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 focus:border-blue-500 focus:outline-none"
          >
            {SORT_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>เรียง: {opt.label}</option>
            ))}
          </select>

          {isFiltered && (
            <button
              onClick={resetFilters}
              className="flex items-center gap-1 rounded-lg border border-slate-300 px-2.5 py-2 text-xs text-slate-500 hover:bg-slate-50 hover:text-slate-700"
            >
              <X size={12} /> ล้างตัวกรอง
            </button>
          )}
        </div>

        {/* ── ชิปกรองสถานะ ─────────────────────────────────────────────────── */}
        <div className="flex flex-wrap items-center gap-1.5 border-b border-slate-100 px-4 py-2.5">
          <span className="mr-1 text-xs text-slate-400">สถานะ:</span>
          <button
            onClick={() => setStatusFilter("all")}
            className={`rounded-full border px-2.5 py-1 text-xs font-medium transition ${
              statusFilter === "all"
                ? "border-slate-800 bg-slate-800 text-white"
                : "border-slate-200 text-slate-600 hover:border-slate-300"
            }`}
          >
            ทั้งหมด {statusCounts.all}
          </button>
          {STATUS_ORDER.map((s) => {
            const meta = STATUS_META[s];
            const active = statusFilter === s;
            return (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition ${
                  active ? meta.badge + " ring-1 ring-inset" : "border-slate-200 text-slate-600 hover:border-slate-300"
                }`}
              >
                <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} />
                {meta.label} {statusCounts[s]}
              </button>
            );
          })}
        </div>

        {/* แถบเลือก + สร้างไฟล์ KTB (ปิดชั่วคราวผ่าน KTB_ENABLED) */}
        {KTB_ENABLED && selected.size > 0 && (
          <div className="flex flex-wrap items-center gap-3 border-b border-blue-100 bg-blue-50 px-4 py-2.5">
            <span className="text-sm font-semibold text-blue-800">
              เลือก {selected.size} รายการ — {formatCurrency(selectedRows.reduce((s, p) => s + Number(p.amount), 0))}
            </span>
            <div className="flex items-center gap-2 text-xs text-slate-600">
              <label>Batch</label>
              <input
                value={batchNo}
                onChange={(e) => setBatchNo(e.target.value.replace(/\D/g, "").slice(0, 6))}
                className="w-20 rounded border border-slate-300 px-2 py-1 font-mono"
              />
              <label>วันที่</label>
              <input
                type="date"
                value={effectiveDate}
                onChange={(e) => setEffectiveDate(e.target.value)}
                className="rounded border border-slate-300 px-2 py-1"
              />
            </div>
            <div className="ml-auto flex items-center gap-2">
              <button
                onClick={() => setShowReport(true)}
                className="flex items-center gap-1 rounded-md border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50"
              >
                <Eye size={12} /> ดู text
              </button>
              <button
                onClick={downloadKTB}
                className="flex items-center gap-1 rounded-md bg-slate-700 px-2.5 py-1 text-xs font-medium text-white hover:bg-slate-800"
              >
                <Download size={12} /> ดาวน์โหลด KTB
              </button>
            </div>
          </div>
        )}

        {visiblePRs.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-14 text-slate-300">
            <Inbox size={28} />
            <p className="text-sm">
              {isFiltered ? "ไม่พบรายการตามเงื่อนไขที่เลือก" : "ยังไม่มีรายการส่งมายังการเงิน"}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="border-b border-slate-100 bg-white">
                <tr>
                  {KTB_ENABLED && (
                    <th className="px-4 py-3 text-left w-10">
                      <button onClick={toggleAll} className="flex items-center">
                        {allSelected ? <CheckSquare size={16} className="text-blue-600" /> : <Square size={16} className="text-slate-400" />}
                      </button>
                    </th>
                  )}
                  <th className="px-4 py-3 text-left font-medium text-slate-500">เลขที่ PR</th>
                  <th className="px-4 py-3 text-left font-medium text-slate-500">ชื่อรายการ</th>
                  <th className="px-4 py-3 text-left font-medium text-slate-500">ผู้ขอ</th>
                  <th className="px-4 py-3 text-left font-medium text-slate-500">บริษัท</th>
                  <th className="px-4 py-3 text-left font-medium text-slate-500 whitespace-nowrap">ช่องทาง</th>
                  <th className="px-4 py-3 text-left font-medium text-slate-500 whitespace-nowrap">สถานะ</th>
                  <th className="px-4 py-3 text-left font-medium text-slate-500 whitespace-nowrap">วันที่</th>
                  <th className="px-4 py-3 text-right font-medium text-slate-500 whitespace-nowrap">จำนวนเงิน</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {visiblePRs.map((pr) => {
                  const theme = themeFor(pr.branch_code);
                  const status = STATUS_META[pr.status];
                  const isChecked = selected.has(pr.id);
                  return (
                    <tr key={pr.id} className={isChecked ? "bg-blue-50/50" : "hover:bg-slate-50"}>
                      {KTB_ENABLED && (
                        <td className="px-4 py-3">
                          <button onClick={() => toggleOne(pr.id)} className="flex items-center">
                            {isChecked ? <CheckSquare size={16} className="text-blue-600" /> : <Square size={16} className="text-slate-400" />}
                          </button>
                        </td>
                      )}
                      <td className="px-4 py-3">
                        <Link
                          href={`/requisitions/${pr.id}`}
                          className="font-mono text-xs font-bold text-blue-600 hover:underline"
                        >
                          {pr.pr_number}
                        </Link>
                      </td>
                      <td className="px-4 py-3 max-w-[220px]">
                        <span className="block truncate font-medium text-slate-800">{pr.title}</span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-slate-500">{pr.requester_name}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-bold ${theme.badge}`}>
                          {pr.branch_code}
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-xs text-slate-500">
                        {pr.channel === "petty_cash" ? "เงินสดย่อย" : pr.channel === "company" ? "บริษัทสั่งจ่าย" : "—"}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${status.badge}`}>
                          <span className={`h-1.5 w-1.5 rounded-full ${status.dot}`} />
                          {status.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-xs text-slate-500">
                        {pr.date ? formatDate(pr.date) : "—"}
                      </td>
                      <td
                        className={`px-4 py-3 text-right font-semibold whitespace-nowrap ${
                          pr.status === "paid" ? "text-green-700"
                            : pr.status === "cancelled" ? "text-slate-400 line-through"
                            : "text-slate-700"
                        }`}
                      >
                        {formatCurrency(pr.amount)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Modal: ดู text ไฟล์ KTB (ปิดชั่วคราวผ่าน KTB_ENABLED) ──────────── */}
      {KTB_ENABLED && showReport && report && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setShowReport(false)}
        >
          <div
            className="flex max-h-[90vh] w-full max-w-3xl flex-col rounded-2xl bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
              <div>
                <p className="font-semibold text-slate-800">ตัวอย่างไฟล์ KTB</p>
                <p className="mt-0.5 text-xs text-slate-500">
                  {report.content ? report.filename : `${selectedRows.length} รายการที่เลือก`}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {report.content && (
                  <button
                    onClick={downloadKTB}
                    className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
                  >
                    <Download size={14} /> ดาวน์โหลด
                  </button>
                )}
                <button
                  onClick={() => setShowReport(false)}
                  className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {report.errors.length > 0 ? (
              <div className="p-5">
                <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3">
                  <AlertCircle size={16} className="mt-0.5 shrink-0 text-red-500" />
                  <ul className="space-y-0.5 text-sm text-red-700">
                    {report.errors.map((e, i) => <li key={i}>{e}</li>)}
                  </ul>
                </div>
              </div>
            ) : (
              <pre className="flex-1 overflow-auto rounded-b-2xl bg-slate-50 p-5 font-mono text-xs leading-5 text-slate-700">
                {report.content}
              </pre>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
