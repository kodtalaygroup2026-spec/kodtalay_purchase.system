"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { formatCurrency, formatDate } from "@/lib/utils/format";
import { AlertTriangle, FileCheck2, FileStack, Inbox, Search, X } from "lucide-react";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { FilterDropdown } from "@/components/shared/FilterDropdown";
import type { PrStatus } from "@/types/database";

export type MyDocState = "complete" | "incomplete_fix" | "incomplete_docs" | "in_progress";

export interface MyDocRow {
  id: string;
  pr_number: string;
  title: string;
  created_at: string;
  status: PrStatus;
  doc_state: MyDocState;
  amount: number;
}

type CardFilter = "all" | "complete" | "incomplete";

type SortKey = "date_desc" | "date_asc" | "amount_desc" | "amount_asc" | "pr_number";

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: "date_desc",   label: "วันที่ล่าสุดก่อน" },
  { value: "date_asc",    label: "วันที่เก่าสุดก่อน" },
  { value: "amount_desc", label: "ยอดเงินมาก → น้อย" },
  { value: "amount_asc",  label: "ยอดเงินน้อย → มาก" },
  { value: "pr_number",   label: "เลขที่ PR" },
];

const DOC_PILL: Record<MyDocState, { label: string; cls: string }> = {
  complete:        { label: "สมบูรณ์",     cls: "bg-green-100 text-green-700" },
  incomplete_fix:  { label: "ตีกลับ",      cls: "bg-orange-100 text-orange-700" },
  incomplete_docs: { label: "ค้างเอกสาร",  cls: "bg-amber-100 text-amber-700" },
  in_progress:     { label: "—",           cls: "text-slate-300" },
};

const isIncomplete = (s: MyDocState) => s === "incomplete_fix" || s === "incomplete_docs";

interface MyDocumentsBoardProps {
  rows: MyDocRow[];
  /** เนื้อหาแทรกระหว่างการ์ดสรุปกับตาราง (เช่น รายการต้องจัดการ) */
  children?: React.ReactNode;
}

export function MyDocumentsBoard({ rows, children }: MyDocumentsBoardProps) {
  const [cardFilter, setCardFilter] = useState<CardFilter>("all");
  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("date_desc");

  const totalCount = rows.length;
  const completeCount = rows.filter((r) => r.doc_state === "complete").length;
  const incompleteCount = rows.filter((r) => isIncomplete(r.doc_state)).length;

  // กดการ์ดซ้ำ = กลับมาดูทั้งหมด
  function toggleCard(filter: CardFilter) {
    setCardFilter((prev) => (prev === filter && filter !== "all" ? "all" : filter));
  }

  const visible = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    const filtered = rows.filter((r) => {
      if (cardFilter === "complete" && r.doc_state !== "complete") return false;
      if (cardFilter === "incomplete" && !isIncomplete(r.doc_state)) return false;
      if (!keyword) return true;
      return (
        r.pr_number.toLowerCase().includes(keyword) ||
        r.title.toLowerCase().includes(keyword)
      );
    });

    const timeOf = (r: MyDocRow) => new Date(r.created_at).getTime();
    const sorted = [...filtered];
    switch (sortKey) {
      case "date_asc":    sorted.sort((a, b) => timeOf(a) - timeOf(b)); break;
      case "amount_desc": sorted.sort((a, b) => Number(b.amount) - Number(a.amount)); break;
      case "amount_asc":  sorted.sort((a, b) => Number(a.amount) - Number(b.amount)); break;
      case "pr_number":   sorted.sort((a, b) => a.pr_number.localeCompare(b.pr_number)); break;
      default:            sorted.sort((a, b) => timeOf(b) - timeOf(a));
    }
    return sorted;
  }, [rows, cardFilter, query, sortKey]);

  const visibleTotal = visible.reduce((sum, r) => sum + Number(r.amount), 0);
  const isFiltered = cardFilter !== "all" || query.trim() !== "";

  const STAT_CARDS: {
    key: CardFilter;
    label: string;
    sub: string;
    count: number;
    icon: React.ElementType;
    iconBg: string;
    iconColor: string;
    countColor: string;
    activeRing: string;
    activeBg: string;
  }[] = [
    {
      key: "all",
      label: "เอกสารทั้งหมด",
      sub: "ที่เคยสร้าง/ส่งทั้งหมด",
      count: totalCount,
      icon: FileStack,
      iconBg: "bg-blue-100",
      iconColor: "text-blue-600",
      countColor: "text-slate-800",
      activeRing: "ring-blue-400",
      activeBg: "bg-blue-50/40",
    },
    {
      key: "complete",
      label: "เอกสารสมบูรณ์",
      sub: "จ่ายแล้ว เอกสารครบ",
      count: completeCount,
      icon: FileCheck2,
      iconBg: "bg-green-100",
      iconColor: "text-green-600",
      countColor: "text-green-600",
      activeRing: "ring-green-400",
      activeBg: "bg-green-50/40",
    },
    {
      key: "incomplete",
      label: "เอกสารไม่สมบูรณ์",
      sub: "ตีกลับ / ค้างเอกสาร",
      count: incompleteCount,
      icon: AlertTriangle,
      iconBg: "bg-amber-100",
      iconColor: "text-amber-600",
      countColor: "text-amber-600",
      activeRing: "ring-amber-400",
      activeBg: "bg-amber-50/40",
    },
  ];

  return (
    <div className="space-y-6">
      {/* ── การ์ดสรุป (กดเพื่อกรองตาราง) ───────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {STAT_CARDS.map((card) => {
          const isActive = cardFilter === card.key;
          return (
            <button
              key={card.key}
              onClick={() => toggleCard(card.key)}
              className={`flex items-center gap-4 rounded-xl border p-4 text-left shadow-sm transition ${
                isActive
                  ? `border-transparent ring-2 ${card.activeRing} ${card.activeBg} shadow-md`
                  : "border-slate-200 bg-white hover:border-slate-300 hover:shadow-md"
              }`}
            >
              <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${card.iconBg}`}>
                <card.icon size={22} className={card.iconColor} />
              </div>
              <div className="min-w-0 flex-1">
                <p className={`text-2xl font-bold leading-none ${card.countColor}`}>{card.count}</p>
                <p className="mt-1 truncate text-sm font-medium text-slate-600">{card.label}</p>
                <p className="truncate text-[11px] text-slate-400">{card.sub}</p>
              </div>
              {isActive && (
                <span className="shrink-0 rounded-full bg-slate-900/5 px-2 py-0.5 text-[10px] font-semibold text-slate-500">
                  ● กำลังดู
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* เนื้อหาแทรก เช่น รายการต้องจัดการ */}
      {children}

      {/* ── ประวัติเอกสารทั้งหมดของฉัน ────────────────────────────────────── */}
      <div className="space-y-3">
        <h2 className="flex items-center gap-2 text-sm font-bold text-slate-700">
          <FileStack size={15} className="text-slate-400" />
          ประวัติเอกสารทั้งหมด ({totalCount})
        </h2>

        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          {/* ค้นหา + เรียงลำดับ */}
          <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 px-4 py-3">
            <div className="relative min-w-[200px] flex-1">
              <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="ค้นหาเลขที่ PR / ชื่อรายการ"
                className="h-[38px] w-full rounded-lg border border-slate-300 pl-9 pr-3 text-sm placeholder:text-slate-400 focus:border-blue-500 focus:outline-none"
              />
            </div>

            <FilterDropdown
              value={sortKey}
              onChange={setSortKey}
              options={SORT_OPTIONS}
              prefix="เรียง"
              defaultValue="date_desc"
            />

            {isFiltered && (
              <button
                onClick={() => { setCardFilter("all"); setQuery(""); setSortKey("date_desc"); }}
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
            <div className="flex flex-col items-center justify-center gap-2 py-16 text-slate-300">
              <Inbox size={28} />
              <p className="text-sm">
                {isFiltered ? "ไม่พบเอกสารตามเงื่อนไขที่เลือก" : "ยังไม่เคยสร้างใบสั่งซื้อ"}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="border-b border-slate-100 bg-slate-50">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium text-slate-500">เลขที่ PR</th>
                    <th className="px-4 py-3 text-left font-medium text-slate-500">ชื่อรายการ</th>
                    <th className="px-4 py-3 text-left font-medium text-slate-500 whitespace-nowrap">วันที่สร้าง</th>
                    <th className="px-4 py-3 text-left font-medium text-slate-500">สถานะ</th>
                    <th className="px-4 py-3 text-left font-medium text-slate-500">เอกสาร</th>
                    <th className="px-4 py-3 text-right font-medium text-slate-500 whitespace-nowrap">ยอดเงิน</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {visible.map((r) => {
                    const pill = DOC_PILL[r.doc_state];
                    return (
                      <tr key={r.id} className="hover:bg-slate-50">
                        <td className="px-4 py-3">
                          <Link
                            href={`/requisitions/${r.id}`}
                            className="font-mono text-xs font-bold text-blue-600 hover:underline"
                          >
                            {r.pr_number}
                          </Link>
                        </td>
                        <td className="px-4 py-3 max-w-[240px]">
                          <span className="block truncate font-medium text-slate-800">{r.title}</span>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-xs text-slate-500">
                          {formatDate(r.created_at)}
                        </td>
                        <td className="px-4 py-3">
                          <StatusBadge kind="pr" status={r.status} />
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          {r.doc_state === "in_progress" ? (
                            <span className="text-xs text-slate-300">—</span>
                          ) : (
                            <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${pill.cls}`}>
                              {pill.label}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right font-semibold text-slate-800 whitespace-nowrap">
                          {formatCurrency(r.amount)}
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
    </div>
  );
}
