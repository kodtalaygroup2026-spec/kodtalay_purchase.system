"use client";

import { useState, useMemo } from "react";
import { Search, X, ArrowUpDown, Zap } from "lucide-react";
import { DisbursementItem, type DisbursementPR } from "./DisbursementItem";
import { FilterDropdown } from "@/components/shared/FilterDropdown";
import { DatePicker } from "@/components/shared/DatePicker";
import { toISODate } from "@/lib/utils/dateRange";

const BRANCH_BADGE: Record<string, string> = {
  BN: "bg-blue-600 text-white", CK: "bg-red-600 text-white", RCA: "bg-emerald-600 text-white",
};
const branchBadge = (code: string) => BRANCH_BADGE[code] ?? "bg-slate-600 text-white";

type SortKey = "recent" | "oldest" | "amount_high" | "amount_low" | "pr_number" | "title";

const SORT_LABELS: Record<SortKey, string> = {
  recent: "ส่งหลักฐานล่าสุด",
  oldest: "ส่งหลักฐานเก่าสุด",
  amount_high: "ยอดเงินมาก → น้อย",
  amount_low: "ยอดเงินน้อย → มาก",
  pr_number: "เลขที่ PR",
  title: "ชื่อรายการ (ก → ฮ)",
};

function amountOf(pr: DisbursementPR) {
  return pr.actual_amount ?? pr.total_amount ?? 0;
}

interface DisbursementBoardProps {
  items: DisbursementPR[];
  currentUserId: string;
}

export function DisbursementBoard({ items, currentUserId }: DisbursementBoardProps) {
  const [search, setSearch] = useState("");
  const [company, setCompany] = useState<string | null>(null);
  const [sort, setSort] = useState<SortKey>("recent");
  const [dateFilter, setDateFilter] = useState("");
  const [amountMin, setAmountMin] = useState("");
  const [amountMax, setAmountMax] = useState("");
  const [urgentOnly, setUrgentOnly] = useState(false);

  // บริษัทที่มีในรายการ (สำหรับ chips)
  const companies = useMemo(
    () => [...new Set(items.map((i) => i.branch_code).filter(Boolean) as string[])],
    [items]
  );

  const hasExtraFilters =
    dateFilter !== "" || amountMin !== "" || amountMax !== "" || urgentOnly || search.trim() !== "";

  function resetFilters() {
    setSearch("");
    setDateFilter("");
    setAmountMin("");
    setAmountMax("");
    setUrgentOnly(false);
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const min = parseFloat(amountMin);
    const max = parseFloat(amountMax);

    let rows = items.filter((pr) => {
      const matchSearch =
        !q ||
        pr.pr_number.toLowerCase().includes(q) ||
        pr.title.toLowerCase().includes(q) ||
        (pr.requester?.full_name ?? "").toLowerCase().includes(q);
      const matchCompany = !company || pr.branch_code === company;
      const matchDate = !dateFilter || toISODate(new Date(pr.submitted_at)) === dateFilter;
      const matchMin = Number.isNaN(min) || amountOf(pr) >= min;
      const matchMax = Number.isNaN(max) || amountOf(pr) <= max;
      const matchUrgent = !urgentOnly || pr.is_urgent;
      return matchSearch && matchCompany && matchDate && matchMin && matchMax && matchUrgent;
    });

    rows = [...rows].sort((a, b) => {
      switch (sort) {
        case "oldest":
          return new Date(a.submitted_at).getTime() - new Date(b.submitted_at).getTime();
        case "amount_high":
          return amountOf(b) - amountOf(a);
        case "amount_low":
          return amountOf(a) - amountOf(b);
        case "pr_number":
          return a.pr_number.localeCompare(b.pr_number);
        case "title":
          return a.title.localeCompare(b.title, "th");
        case "recent":
        default:
          return new Date(b.submitted_at).getTime() - new Date(a.submitted_at).getTime();
      }
    });

    // รายการด่วนขึ้นก่อนเสมอ (ภายใต้ sort ที่เลือก)
    return [...rows.filter((r) => r.is_urgent), ...rows.filter((r) => !r.is_urgent)];
  }, [items, search, company, sort, dateFilter, amountMin, amountMax, urgentOnly]);

  return (
    <div className="space-y-4">
      {/* ── แถบกรอง / จัดเรียง ─────────────────────────────────────────────── */}
      <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[180px] flex-1">
            <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="ค้นหาเลขที่ / ชื่อ / ผู้ขอ..."
              className="h-[38px] w-full rounded-lg border border-slate-300 pl-9 pr-8 text-sm placeholder:text-slate-400 focus:border-blue-500 focus:outline-none"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* วันที่ส่งหลักฐาน */}
          <div className="w-[170px]">
            <DatePicker value={dateFilter} onChange={setDateFilter} placeholder="วันที่ส่งหลักฐาน" />
          </div>

          {/* ช่วงยอดเงิน */}
          <div className="flex items-center gap-1">
            <input
              value={amountMin}
              onChange={(e) => setAmountMin(e.target.value.replace(/[^\d.]/g, ""))}
              placeholder="ยอดต่ำสุด"
              inputMode="decimal"
              className="h-[38px] w-24 rounded-lg border border-slate-300 px-2.5 text-right text-sm placeholder:text-slate-400 focus:border-blue-500 focus:outline-none"
            />
            <span className="text-slate-300">–</span>
            <input
              value={amountMax}
              onChange={(e) => setAmountMax(e.target.value.replace(/[^\d.]/g, ""))}
              placeholder="ยอดสูงสุด"
              inputMode="decimal"
              className="h-[38px] w-24 rounded-lg border border-slate-300 px-2.5 text-right text-sm placeholder:text-slate-400 focus:border-blue-500 focus:outline-none"
            />
          </div>

          {/* เฉพาะงานด่วน */}
          <button
            onClick={() => setUrgentOnly((v) => !v)}
            className={`flex h-[38px] items-center gap-1.5 rounded-lg border px-3 text-sm font-medium transition ${
              urgentOnly
                ? "border-red-400 bg-red-50 text-red-600"
                : "border-slate-300 bg-white text-slate-500 hover:border-slate-400"
            }`}
          >
            <Zap size={14} className={urgentOnly ? "text-red-500" : "text-slate-400"} />
            งานด่วน
          </button>

          <FilterDropdown
            value={sort}
            onChange={setSort}
            options={(Object.keys(SORT_LABELS) as SortKey[]).map((k) => ({ value: k, label: SORT_LABELS[k] }))}
            prefix="เรียง"
            icon={ArrowUpDown}
            defaultValue="recent"
          />

          {hasExtraFilters && (
            <button
              onClick={resetFilters}
              className="flex h-[38px] items-center gap-1 rounded-lg border border-slate-300 px-2.5 text-xs text-slate-500 hover:bg-slate-50 hover:text-slate-700"
            >
              <X size={12} /> ล้างตัวกรอง
            </button>
          )}

          <span className="ml-auto whitespace-nowrap text-xs text-slate-400">
            {filtered.length} รายการ{items.length !== filtered.length ? ` จาก ${items.length}` : ""}
          </span>
        </div>
      </div>

      {/* ── chips บริษัท ───────────────────────────────────────────────────── */}
      {companies.length > 1 && (
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setCompany(null)}
            className={`rounded-lg border px-3 py-1 text-xs font-medium transition ${
              company === null
                ? "border-slate-700 bg-slate-700 text-white"
                : "border-slate-200 bg-white text-slate-500 hover:border-slate-300"
            }`}
          >
            ทั้งหมด
          </button>
          {companies.map((code) => (
            <button
              key={code}
              onClick={() => setCompany((prev) => (prev === code ? null : code))}
              className={`flex items-center gap-1.5 rounded-lg border px-3 py-1 text-xs font-medium transition ${
                company === code
                  ? "border-slate-700 bg-slate-50 text-slate-800"
                  : "border-slate-200 bg-white text-slate-500 hover:border-slate-300"
              }`}
            >
              <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${branchBadge(code)}`}>{code}</span>
              {items.find((i) => i.branch_code === code)?.branch_name ?? code}
            </button>
          ))}
        </div>
      )}

      {/* ── รายการ ─────────────────────────────────────────────────────────── */}
      {filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white py-12 text-center text-sm text-slate-400">
          ไม่พบรายการที่ตรงกับเงื่อนไข
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((pr) => (
            <DisbursementItem key={pr.evidence!.id} pr={pr} currentUserId={currentUserId} />
          ))}
        </div>
      )}
    </div>
  );
}
