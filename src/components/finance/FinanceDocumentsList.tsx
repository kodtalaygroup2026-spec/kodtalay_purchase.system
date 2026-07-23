"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { formatCurrency, formatDate } from "@/lib/utils/format";
import { Inbox, Building2, Wallet, Search, X } from "lucide-react";
import { DateRangePicker } from "@/components/shared/DateRangePicker";
import { BranchBadge } from "@/components/shared/BranchBadge";
import { FilterDropdown } from "@/components/shared/FilterDropdown";
import { EMPTY_DATE_RANGE, isDateInRange, isRangeEmpty, type DateRange } from "@/lib/utils/dateRange";

export interface DocRow {
  id: string;
  pr_number: string;
  title: string;
  amount: number;
  branch_code: string;
  requester_name: string;
  /** วันที่จ่าย (สมบูรณ์) หรือวันที่ตีกลับ (ไม่สมบูรณ์) */
  date: string | null;
  payment_channel: "company" | "petty_cash" | null;
  close_status: "complete" | "incomplete" | null;
  /** เหตุผลตีกลับ (เฉพาะไม่สมบูรณ์) */
  review_note: string | null;
}

interface Props {
  docs: DocRow[];
}

type Tab = "all" | "complete" | "incomplete";

const TABS: { key: Tab; label: string }[] = [
  { key: "all",        label: "ทั้งหมด" },
  { key: "complete",   label: "สมบูรณ์" },
  { key: "incomplete", label: "ไม่สมบูรณ์" },
];

type SortKey = "date_desc" | "date_asc" | "amount_desc" | "amount_asc" | "pr_number";

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: "date_desc",   label: "วันที่ล่าสุดก่อน" },
  { value: "date_asc",    label: "วันที่เก่าสุดก่อน" },
  { value: "amount_desc", label: "ยอดเงินมาก → น้อย" },
  { value: "amount_asc",  label: "ยอดเงินน้อย → มาก" },
  { value: "pr_number",   label: "เลขที่ PR" },
];

export function FinanceDocumentsList({ docs }: Props) {
  const [tab, setTab] = useState<Tab>("all");
  const [dateRange, setDateRange] = useState<DateRange>(EMPTY_DATE_RANGE);
  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("date_desc");

  // กรองทุกอย่างยกเว้นแท็บ เพื่อให้ตัวเลขบนแท็บตรงกับสิ่งที่กดดูได้จริง
  const filteredExceptTab = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    return docs.filter((d) => {
      if (!isDateInRange(d.date, dateRange)) return false;
      if (!keyword) return true;
      return (
        d.pr_number.toLowerCase().includes(keyword) ||
        d.title.toLowerCase().includes(keyword) ||
        d.requester_name.toLowerCase().includes(keyword)
      );
    });
  }, [docs, dateRange, query]);

  const counts = {
    all: filteredExceptTab.length,
    complete: filteredExceptTab.filter((d) => d.close_status === "complete").length,
    incomplete: filteredExceptTab.filter((d) => d.close_status === "incomplete").length,
  };

  const visible = useMemo(() => {
    const rows =
      tab === "all" ? filteredExceptTab : filteredExceptTab.filter((d) => d.close_status === tab);

    const timeOf = (d: DocRow) => (d.date ? new Date(d.date).getTime() : 0);
    const sorted = [...rows];
    switch (sortKey) {
      case "date_asc":    sorted.sort((a, b) => timeOf(a) - timeOf(b)); break;
      case "amount_desc": sorted.sort((a, b) => Number(b.amount) - Number(a.amount)); break;
      case "amount_asc":  sorted.sort((a, b) => Number(a.amount) - Number(b.amount)); break;
      case "pr_number":   sorted.sort((a, b) => a.pr_number.localeCompare(b.pr_number)); break;
      default:            sorted.sort((a, b) => timeOf(b) - timeOf(a));
    }
    return sorted;
  }, [filteredExceptTab, tab, sortKey]);

  const visibleTotal = visible.reduce((sum, d) => sum + Number(d.amount), 0);
  const isFiltered = query.trim() !== "" || !isRangeEmpty(dateRange);

  function resetFilters() {
    setDateRange(EMPTY_DATE_RANGE);
    setQuery("");
    setSortKey("date_desc");
  }

  return (
    <div className="space-y-4">
      {/* แท็บ (กล่องครอบแบบเดียวกับหน้าตำแหน่งผู้ดูแล — ตัวที่เลือกเป็นสีน้ำเงินชัด) */}
      <div className="flex w-fit flex-wrap gap-1 rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition ${
              tab === t.key
                ? "bg-blue-500 text-white shadow-sm"
                : "text-slate-500 hover:bg-slate-100"
            }`}
          >
            {t.label}
            <span className={`rounded-full px-1.5 text-[10px] font-bold ${
              tab === t.key ? "bg-white/25 text-white" : "bg-slate-100 text-slate-500"
            }`}>{counts[t.key]}</span>
          </button>
        ))}
      </div>

      {/* ตาราง */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        {/* ค้นหา + ช่วงวันที่จ่าย + เรียงลำดับ */}
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 px-4 py-3">
          <div className="relative min-w-[220px] flex-1">
            <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="ค้นหาเลขที่ PR / ชื่อรายการ / ผู้ขอ"
              className="h-[38px] w-full rounded-lg border border-slate-300 pl-9 pr-3 text-sm placeholder:text-slate-400 focus:border-blue-500 focus:outline-none"
            />
          </div>

          <DateRangePicker value={dateRange} onChange={setDateRange} placeholder="วันที่: ทุกช่วงเวลา" />

          <FilterDropdown
            value={sortKey}
            onChange={setSortKey}
            options={SORT_OPTIONS}
            prefix="เรียง"
            defaultValue="date_desc"
          />

          {isFiltered && (
            <button
              onClick={resetFilters}
              className="flex h-[38px] items-center gap-1 rounded-lg border border-slate-300 px-2.5 text-xs text-slate-500 hover:bg-slate-50 hover:text-slate-700"
            >
              <X size={12} /> ล้างตัวกรอง
            </button>
          )}

          <span className="ml-auto whitespace-nowrap text-xs text-slate-400">
            {visible.length} รายการ · {formatCurrency(visibleTotal)}
          </span>
        </div>

        {visible.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-14 text-slate-300">
            <Inbox size={28} />
            <p className="text-sm">
              {isFiltered ? "ไม่พบเอกสารตามเงื่อนไขที่เลือก" : "ไม่มีเอกสารในหมวดนี้"}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="border-b border-slate-100 bg-slate-50">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-slate-500">เลขที่ PR</th>
                  <th className="px-4 py-3 text-left font-medium text-slate-500">ชื่อรายการ</th>
                  <th className="px-4 py-3 text-left font-medium text-slate-500">ผู้ขอ</th>
                  <th className="px-4 py-3 text-left font-medium text-slate-500">บริษัท</th>
                  <th className="px-4 py-3 text-left font-medium text-slate-500">ช่องทาง</th>
                  <th className="px-4 py-3 text-left font-medium text-slate-500 whitespace-nowrap">วันที่</th>
                  <th className="px-4 py-3 text-left font-medium text-slate-500">สถานะเอกสาร</th>
                  <th className="px-4 py-3 text-right font-medium text-slate-500 whitespace-nowrap">ยอด</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {visible.map((d) => {
                  const isIncomplete = d.close_status === "incomplete";
                  return (
                  <tr key={d.id} className={isIncomplete ? "bg-amber-50/40 hover:bg-amber-50" : "hover:bg-slate-50"}>
                    <td className="px-4 py-3 align-top">
                      <Link href={`/requisitions/${d.id}`} className="font-mono text-xs font-bold text-blue-600 hover:underline">
                        {d.pr_number}
                      </Link>
                    </td>
                    <td className="px-4 py-3 max-w-[220px] align-top">
                      <span className="block truncate font-medium text-slate-800">{d.title}</span>
                      {isIncomplete && d.review_note && (
                        <span className="mt-0.5 block truncate text-[11px] text-amber-700" title={d.review_note}>
                          เหตุผลตีกลับ: {d.review_note}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 align-top whitespace-nowrap text-slate-500">{d.requester_name}</td>
                    <td className="px-4 py-3 align-top">
                      <BranchBadge code={d.branch_code} />
                    </td>
                    <td className="px-4 py-3 align-top whitespace-nowrap">
                      {d.payment_channel === "petty_cash" ? (
                        <span className="inline-flex items-center gap-1 text-xs text-emerald-600">
                          <Wallet size={12} /> เงินสดย่อย
                        </span>
                      ) : d.payment_channel === "company" ? (
                        <span className="inline-flex items-center gap-1 text-xs text-blue-600">
                          <Building2 size={12} /> บริษัท
                        </span>
                      ) : (
                        <span className="text-xs text-slate-300">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 align-top whitespace-nowrap text-xs text-slate-500">
                      {d.date ? formatDate(d.date) : "—"}
                    </td>
                    <td className="px-4 py-3 align-top">
                      {d.close_status === "complete" ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-[11px] font-semibold text-green-700">
                          <span className="h-1.5 w-1.5 rounded-full bg-green-500" /> สมบูรณ์ · จ่ายแล้ว
                        </span>
                      ) : d.close_status === "incomplete" ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-700">
                          <span className="h-1.5 w-1.5 rounded-full bg-amber-500" /> ไม่สมบูรณ์ · รอแก้ไข
                        </span>
                      ) : (
                        <span className="text-xs text-slate-300">—</span>
                      )}
                    </td>
                    <td className={`px-4 py-3 align-top text-right font-semibold whitespace-nowrap ${isIncomplete ? "text-slate-500" : "text-slate-800"}`}>
                      {formatCurrency(d.amount)}
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
