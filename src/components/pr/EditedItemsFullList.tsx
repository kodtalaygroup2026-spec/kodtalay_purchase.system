"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  ChevronDown,
  ChevronUp,
  ChevronsUpDown,
  ExternalLink,
  Pencil,
} from "lucide-react";
import { formatDate, formatDateTime, formatCurrency } from "@/lib/utils/format";
import type { EditedPRRow } from "./EditedItemsPanel";

interface ItemChange {
  item_id: string;
  description: string;
  quantity_old: number;
  quantity_new: number;
  unit_price_old: number;
  unit_price_new: number;
}

type SortKey = "pr_number" | "requester_name" | "log_count" | "last_edited" | "total_amount";
type SortDir = "asc" | "desc";

// ── Sort helper ──────────────────────────────────────────────────────────────

function sortRows(rows: EditedPRRow[], key: SortKey, dir: SortDir): EditedPRRow[] {
  return [...rows].sort((a, b) => {
    let av: string | number;
    let bv: string | number;
    if (key === "pr_number") { av = a.pr_number; bv = b.pr_number; }
    else if (key === "requester_name") { av = a.requester_name; bv = b.requester_name; }
    else if (key === "log_count") { av = a.logs.length; bv = b.logs.length; }
    else if (key === "total_amount") { av = a.total_amount; bv = b.total_amount; }
    else {
      // last_edited — ใช้ edited_at ของ log แรก (ล่าสุด เพราะ order desc)
      av = a.logs[0]?.edited_at ?? "";
      bv = b.logs[0]?.edited_at ?? "";
    }
    if (typeof av === "number" && typeof bv === "number") {
      return dir === "asc" ? av - bv : bv - av;
    }
    av = String(av).toLowerCase();
    bv = String(bv).toLowerCase();
    if (av < bv) return dir === "asc" ? -1 : 1;
    if (av > bv) return dir === "asc" ? 1 : -1;
    return 0;
  });
}

// ── SortTh ───────────────────────────────────────────────────────────────────

function SortTh({
  label,
  col,
  active,
  dir,
  onSort,
  className = "",
}: {
  label: string;
  col: SortKey;
  active: SortKey;
  dir: SortDir;
  onSort: (col: SortKey) => void;
  className?: string;
}) {
  const isActive = active === col;
  return (
    <th className={`px-4 py-3 ${className}`}>
      <button
        onClick={() => onSort(col)}
        className="group flex items-center gap-1 font-medium text-slate-500 hover:text-slate-700"
      >
        {label}
        <span
          className={`transition ${
            isActive
              ? "text-blue-500"
              : "text-slate-300 group-hover:text-slate-400"
          }`}
        >
          {isActive ? (
            dir === "asc" ? (
              <ChevronUp size={13} />
            ) : (
              <ChevronDown size={13} />
            )
          ) : (
            <ChevronsUpDown size={13} />
          )}
        </span>
      </button>
    </th>
  );
}

// ── Main component ───────────────────────────────────────────────────────────

export function EditedItemsFullList({ prs }: { prs: EditedPRRow[] }) {
  const router = useRouter();
  const [sortKey, setSortKey] = useState<SortKey>("last_edited");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  function handleSort(col: SortKey) {
    if (col === sortKey) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(col); setSortDir("asc"); }
  }

  if (prs.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 bg-white py-16 text-center">
        <p className="text-slate-500">ไม่มีรายการที่มีการแก้ไข</p>
      </div>
    );
  }

  const sorted = sortRows(prs, sortKey, sortDir);

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="border-b border-slate-100 bg-slate-50">
            <tr>
              <SortTh
                label="เลขที่ PR"
                col="pr_number"
                active={sortKey}
                dir={sortDir}
                onSort={handleSort}
                className="text-left"
              />
              <th className="px-4 py-3 text-left font-medium text-slate-500">
                ชื่อ / ผู้ขอ
              </th>
              <SortTh
                label="แก้ไข"
                col="log_count"
                active={sortKey}
                dir={sortDir}
                onSort={handleSort}
                className="text-center"
              />
              <SortTh
                label="วันที่ล่าสุด"
                col="last_edited"
                active={sortKey}
                dir={sortDir}
                onSort={handleSort}
                className="text-left"
              />
              <SortTh
                label="ยอดปัจจุบัน"
                col="total_amount"
                active={sortKey}
                dir={sortDir}
                onSort={handleSort}
                className="text-right"
              />
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {sorted.map((pr) => {
              const isExpanded = expandedId === pr.pr_id;
              const lastLog = pr.logs[0];

              return [
                // ── Main row ──────────────────────────────────────────────
                <tr
                  key={pr.pr_id}
                  className="cursor-pointer transition-colors hover:bg-slate-50"
                  onClick={() =>
                    setExpandedId((prev) =>
                      prev === pr.pr_id ? null : pr.pr_id
                    )
                  }
                >
                  <td className="px-4 py-3">
                    <span className="font-mono text-xs font-bold text-blue-700">
                      {pr.pr_number}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-medium text-slate-800">{pr.title}</p>
                    <p className="text-xs text-slate-400">{pr.requester_name}</p>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-amber-100 px-2 text-xs font-bold text-amber-700">
                      {pr.logs.length}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-500">
                    {lastLog ? formatDate(lastLog.edited_at) : "—"}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-slate-800">
                    {formatCurrency(pr.total_amount)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          router.push(`/requisitions/${pr.pr_id}`);
                        }}
                        className="flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-600 hover:bg-slate-50"
                      >
                        ดู <ExternalLink size={10} />
                      </button>
                      {isExpanded ? (
                        <ChevronUp size={14} className="text-slate-400" />
                      ) : (
                        <ChevronDown size={14} className="text-slate-400" />
                      )}
                    </div>
                  </td>
                </tr>,

                // ── Expanded log rows ──────────────────────────────────────
                isExpanded && (
                  <tr key={`${pr.pr_id}-expanded`}>
                    <td colSpan={6} className="bg-amber-50 px-6 py-4">
                      <div className="space-y-3">
                        <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-amber-700">
                          <Pencil size={11} />
                          ประวัติการแก้ไขรายการสินค้า
                        </p>
                        {pr.logs.map((log) => (
                          <div
                            key={log.id}
                            className="rounded-lg border border-amber-200 bg-white px-4 py-3"
                          >
                            <p className="mb-2 text-[11px] font-semibold text-amber-700">
                              แก้ไขโดย {log.editor_name} ·{" "}
                              {formatDateTime(log.edited_at)}
                            </p>
                            <table className="w-full text-xs">
                              <thead>
                                <tr className="text-slate-400">
                                  <th className="pb-1 pr-4 text-left font-medium">
                                    สินค้า
                                  </th>
                                  <th className="pb-1 pr-4 text-right font-medium">
                                    จำนวนเดิม
                                  </th>
                                  <th className="pb-1 pr-4 text-right font-medium">
                                    จำนวนใหม่
                                  </th>
                                  <th className="pb-1 pr-4 text-right font-medium">
                                    ราคาเดิม
                                  </th>
                                  <th className="pb-1 text-right font-medium">
                                    ราคาใหม่
                                  </th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100">
                                {(log.changes as ItemChange[]).map((ch, i) => (
                                  <tr key={i}>
                                    <td className="py-1 pr-4 font-medium text-slate-700">
                                      {ch.description}
                                    </td>
                                    <td className="py-1 pr-4 text-right text-slate-400">
                                      {ch.quantity_old}
                                    </td>
                                    <td
                                      className={`py-1 pr-4 text-right font-semibold ${
                                        ch.quantity_old !== ch.quantity_new
                                          ? "text-blue-700"
                                          : "text-slate-400"
                                      }`}
                                    >
                                      {ch.quantity_new}
                                    </td>
                                    <td className="py-1 pr-4 text-right text-slate-400">
                                      {formatCurrency(ch.unit_price_old)}
                                    </td>
                                    <td
                                      className={`py-1 text-right font-semibold ${
                                        ch.unit_price_old !== ch.unit_price_new
                                          ? "text-blue-700"
                                          : "text-slate-400"
                                      }`}
                                    >
                                      {formatCurrency(ch.unit_price_new)}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        ))}
                      </div>
                    </td>
                  </tr>
                ),
              ];
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
