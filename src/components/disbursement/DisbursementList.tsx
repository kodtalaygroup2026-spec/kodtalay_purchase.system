"use client";

import { useState, useMemo } from "react";
import { Search, ArrowUpDown } from "lucide-react";
import { DisbursementItem, type DisbursementPR } from "./DisbursementItem";

type SortKey = "newest" | "oldest" | "amount_desc" | "amount_asc";
type StatusFilter = "all" | "paid" | "cancelled";

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: "newest",      label: "ล่าสุดก่อน" },
  { value: "oldest",      label: "เก่าสุดก่อน" },
  { value: "amount_desc", label: "ยอดสูงสุดก่อน" },
  { value: "amount_asc",  label: "ยอดต่ำสุดก่อน" },
];

const STATUS_TABS: { value: StatusFilter; label: string }[] = [
  { value: "all",       label: "ทั้งหมด" },
  { value: "paid",      label: "จ่ายแล้ว" },
  { value: "cancelled", label: "ยกเลิก" },
];

interface DisbursementListProps {
  items: DisbursementPR[];
}

export function DisbursementList({ items }: DisbursementListProps) {
  const [search, setSearch]             = useState("");
  const [sort, setSort]                 = useState<SortKey>("newest");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  const filtered = useMemo(() => {
    let list = [...items];

    if (statusFilter !== "all") {
      list = list.filter(pr => pr.status === statusFilter);
    }

    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(pr =>
        pr.pr_number.toLowerCase().includes(q) ||
        pr.title.toLowerCase().includes(q) ||
        (pr.requester?.full_name ?? "").toLowerCase().includes(q)
      );
    }

    list.sort((a, b) => {
      switch (sort) {
        case "newest":
          return new Date(b.submitted_at).getTime() - new Date(a.submitted_at).getTime();
        case "oldest":
          return new Date(a.submitted_at).getTime() - new Date(b.submitted_at).getTime();
        case "amount_desc":
          return (b.actual_amount ?? b.total_amount) - (a.actual_amount ?? a.total_amount);
        case "amount_asc":
          return (a.actual_amount ?? a.total_amount) - (b.actual_amount ?? b.total_amount);
        default:
          return 0;
      }
    });

    return list;
  }, [items, search, sort, statusFilter]);

  const countByStatus = useMemo(() => {
    const counts: Record<string, number> = { all: items.length };
    for (const pr of items) {
      counts[pr.status] = (counts[pr.status] ?? 0) + 1;
    }
    return counts;
  }, [items]);

  if (items.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 bg-white py-10 text-center">
        <Search size={24} className="mx-auto mb-2 text-slate-300" />
        <p className="text-sm text-slate-400">ยังไม่มีประวัติการจ่าย</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Controls row */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="ค้นหาเลข PR, ชื่อรายการ, ผู้ขอ..."
            className="w-full rounded-lg border border-slate-200 bg-white py-2.5 pl-9 pr-4 text-sm placeholder:text-slate-400 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
          />
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <ArrowUpDown size={14} className="text-slate-400" />
          <select
            value={sort}
            onChange={e => setSort(e.target.value as SortKey)}
            className="rounded-lg border border-slate-200 bg-white py-2.5 pl-3 pr-8 text-sm text-slate-700 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100 appearance-none"
          >
            {SORT_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Status filter tabs */}
      <div className="flex gap-1 overflow-x-auto border-b border-slate-200">
        {STATUS_TABS.map(tab => {
          const count = tab.value === "all" ? countByStatus["all"] : (countByStatus[tab.value] ?? 0);
          const isActive = statusFilter === tab.value;
          return (
            <button
              key={tab.value}
              onClick={() => setStatusFilter(tab.value)}
              className={`flex shrink-0 items-center gap-1.5 border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
                isActive
                  ? "border-blue-600 text-blue-700"
                  : "border-transparent text-slate-500 hover:text-slate-700"
              }`}
            >
              {tab.label}
              <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                isActive ? "bg-blue-100 text-blue-700" : "bg-slate-100 text-slate-500"
              }`}>
                {count ?? 0}
              </span>
            </button>
          );
        })}
      </div>

      {/* Results */}
      {filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white py-10 text-center">
          <Search size={24} className="mx-auto mb-2 text-slate-300" />
          <p className="text-sm text-slate-400">ไม่พบรายการที่ค้นหา</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(pr => (
            <DisbursementItem key={pr.id} pr={pr} />
          ))}
        </div>
      )}

      {filtered.length > 0 && (
        <p className="text-center text-xs text-slate-400">
          แสดง {filtered.length} จาก {items.length} รายการ
        </p>
      )}
    </div>
  );
}
