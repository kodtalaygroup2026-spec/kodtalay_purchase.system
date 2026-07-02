"use client";

import { useState, useMemo } from "react";
import { Search, X, ArrowUpDown } from "lucide-react";
import { DisbursementItem, type DisbursementPR } from "./DisbursementItem";

const BRANCH_BADGE: Record<string, string> = {
  BN: "bg-blue-600 text-white", CK: "bg-red-600 text-white", RCA: "bg-emerald-600 text-white",
};
const branchBadge = (code: string) => BRANCH_BADGE[code] ?? "bg-slate-600 text-white";

type SortKey = "recent" | "oldest" | "amount_high" | "amount_low";

const SORT_LABELS: Record<SortKey, string> = {
  recent: "ส่งหลักฐานล่าสุด",
  oldest: "ส่งหลักฐานเก่าสุด",
  amount_high: "ยอดเงินมาก → น้อย",
  amount_low: "ยอดเงินน้อย → มาก",
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

  // บริษัทที่มีในรายการ (สำหรับ chips)
  const companies = useMemo(
    () => [...new Set(items.map((i) => i.branch_code).filter(Boolean) as string[])],
    [items]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let rows = items.filter((pr) => {
      const matchSearch =
        !q ||
        pr.pr_number.toLowerCase().includes(q) ||
        pr.title.toLowerCase().includes(q) ||
        (pr.requester?.full_name ?? "").toLowerCase().includes(q);
      const matchCompany = !company || pr.branch_code === company;
      return matchSearch && matchCompany;
    });

    rows = [...rows].sort((a, b) => {
      switch (sort) {
        case "oldest":
          return new Date(a.submitted_at).getTime() - new Date(b.submitted_at).getTime();
        case "amount_high":
          return amountOf(b) - amountOf(a);
        case "amount_low":
          return amountOf(a) - amountOf(b);
        case "recent":
        default:
          return new Date(b.submitted_at).getTime() - new Date(a.submitted_at).getTime();
      }
    });

    // รายการด่วนขึ้นก่อนเสมอ (ภายใต้ sort ที่เลือก)
    return [...rows.filter((r) => r.is_urgent), ...rows.filter((r) => !r.is_urgent)];
  }, [items, search, company, sort]);

  return (
    <div className="space-y-4">
      {/* ── แถบกรอง / จัดเรียง ─────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-[200px] flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="ค้นหาเลขที่ / ชื่อ / ผู้ขอ..."
            className="w-full rounded-lg border border-slate-300 py-2 pl-9 pr-8 text-sm focus:border-blue-500 focus:outline-none"
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

        <div className="flex items-center gap-1.5">
          <ArrowUpDown size={14} className="text-slate-400" />
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 focus:border-blue-500 focus:outline-none"
          >
            {(Object.keys(SORT_LABELS) as SortKey[]).map((k) => (
              <option key={k} value={k}>{SORT_LABELS[k]}</option>
            ))}
          </select>
        </div>

        <span className="ml-auto text-xs text-slate-400">
          {filtered.length} รายการ{items.length !== filtered.length ? ` จาก ${items.length}` : ""}
        </span>
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
