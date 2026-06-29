"use client";

import { useState, Fragment } from "react";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import { ChevronDown, ChevronRight, Search, X } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/utils/format";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { PR_STATUS_LABELS } from "@/lib/constants";
import type { PrStatus, PoStatus } from "@/types/database";

// ── Types ──────────────────────────────────────────────────────────────────

interface LinkedPO {
  id: string;
  po_number: string;
  status: PoStatus;
  total_amount: number;
  vendor_name: string | null;
}

export interface PRRow {
  id: string;
  pr_number: string;
  title: string;
  status: PrStatus;
  total_amount: number;
  created_at: string;
  needed_by: string | null;
  is_urgent: boolean;
  profiles: { full_name: string } | null;
  purchase_orders: LinkedPO[];
}

interface ExpandedItem {
  id: string;
  line_no: number;
  description: string;
  quantity: number;
  unit: string;
  unit_price: number;
}

// ── Step state helper ──────────────────────────────────────────────────────

type StepState = "done" | "current" | "error" | "locked";

function getStepState(
  idx: number,
  prStatus: PrStatus,
  hasPO: boolean,
  poStatus?: PoStatus,
): StepState {
  if (idx === 0) {
    if (["rejected", "cancelled"].includes(prStatus)) return "error";
    if (["submitted", "pending_second_approval", "approved", "converted"].includes(prStatus) || hasPO) return "done";
    return "current";
  }
  if (idx === 1) {
    if (prStatus === "rejected") return "error";
    if (["approved", "converted"].includes(prStatus) || hasPO) return "done";
    if (["submitted", "pending_second_approval"].includes(prStatus)) return "current";
    return "locked";
  }
  if (idx === 2) {
    if (hasPO) return "done";
    if (prStatus === "approved") return "current";
    return "locked";
  }
  // idx === 3
  if (poStatus === "approved") return "done";
  if (hasPO) return "current";
  return "locked";
}

// ── Progress dots ──────────────────────────────────────────────────────────

function ProgressDots({ prStatus, pos }: { prStatus: PrStatus; pos: LinkedPO[] }) {
  const hasPO = pos.length > 0;
  const poStatus = pos[0]?.status as PoStatus | undefined;

  const dotColor = (state: StepState) => {
    if (state === "done") return "bg-green-500";
    if (state === "current") return "bg-blue-500";
    if (state === "error") return "bg-red-400";
    return "bg-slate-200";
  };
  const lineColor = (state: StepState) =>
    state === "done" ? "bg-green-300" : "bg-slate-200";

  return (
    <div className="flex items-center gap-0.5 justify-center">
      {[0, 1, 2, 3].map(i => {
        const state = getStepState(i, prStatus, hasPO, poStatus);
        return (
          <Fragment key={i}>
            <div className={`h-2.5 w-2.5 rounded-sm ${dotColor(state)}`} />
            {i < 3 && <div className={`h-0.5 w-3 ${lineColor(state)}`} />}
          </Fragment>
        );
      })}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────

export function RequisitionList({ prs }: { prs: PRRow[] }) {
  const supabase = createClient();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<PrStatus | "">("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [expandedItems, setExpandedItems] = useState<Record<string, ExpandedItem[]>>({});
  const [loadingExpand, setLoadingExpand] = useState<string | null>(null);

  // ── Filter ───────────────────────────────────────────────────────────────
  const filtered = prs.filter(pr => {
    const q = search.toLowerCase();
    const matchSearch =
      !q ||
      pr.pr_number.toLowerCase().includes(q) ||
      pr.title.toLowerCase().includes(q) ||
      (pr.profiles?.full_name ?? "").toLowerCase().includes(q);
    const matchStatus = !statusFilter || pr.status === statusFilter;
    return matchSearch && matchStatus;
  });

  // ── Expand / collapse row ─────────────────────────────────────────────────
  async function handleRowClick(prId: string) {
    if (expandedId === prId) {
      setExpandedId(null);
      return;
    }
    setExpandedId(prId);
    if (!expandedItems[prId]) {
      setLoadingExpand(prId);
      const { data } = await supabase
        .from("pr_items")
        .select("id, line_no, description, quantity, unit, unit_price")
        .eq("pr_id", prId)
        .order("line_no")
        .limit(4);
      setExpandedItems(prev => ({
        ...prev,
        [prId]: (data ?? []) as ExpandedItem[],
      }));
      setLoadingExpand(null);
    }
  }

  return (
    <div className="space-y-4">
      {/* ── Filter bar ───────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="ค้นหาเลขที่ / ชื่อ / ผู้ขอ..."
            className="w-full rounded-lg border border-slate-300 pl-9 pr-8 py-2 text-sm focus:border-blue-500 focus:outline-none"
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

        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value as PrStatus | "")}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 focus:border-blue-500 focus:outline-none"
        >
          <option value="">สถานะทั้งหมด</option>
          {(Object.entries(PR_STATUS_LABELS) as [PrStatus, string][]).map(([val, label]) => (
            <option key={val} value={val}>{label}</option>
          ))}
        </select>

        {(search || statusFilter) && (
          <button
            onClick={() => { setSearch(""); setStatusFilter(""); }}
            className="text-sm text-slate-500 hover:text-slate-700"
          >
            ล้างตัวกรอง
          </button>
        )}

        <span className="ml-auto text-xs text-slate-400">
          {filtered.length} รายการ
          {prs.length !== filtered.length ? ` จาก ${prs.length}` : ""}
        </span>
      </div>

      {/* ── Table ────────────────────────────────────────────────────────── */}
      {filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white py-12 text-center">
          <p className="text-slate-400 text-sm">ไม่พบรายการที่ตรงกับเงื่อนไข</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="min-w-full text-sm">
            <thead className="border-b border-slate-100 bg-slate-50">
              <tr>
                <th className="w-8 px-3 py-3" />
                <th className="px-4 py-3 text-left font-medium text-slate-500">เลขที่ PR</th>
                <th className="px-4 py-3 text-left font-medium text-slate-500">ชื่อ / ผู้ขอ</th>
                <th className="px-4 py-3 text-center font-medium text-slate-500 hidden md:table-cell">
                  Progress
                </th>
                <th className="px-4 py-3 text-center font-medium text-slate-500">สถานะ PR</th>
                <th className="px-4 py-3 text-center font-medium text-slate-500 hidden lg:table-cell">
                  สถานะ PO
                </th>
                <th className="px-4 py-3 text-right font-medium text-slate-500">มูลค่า</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(pr => {
                const isExpanded = expandedId === pr.id;
                const pos = pr.purchase_orders ?? [];
                const primaryPO = pos[0] ?? null;
                const items = expandedItems[pr.id] ?? [];
                const isLoading = loadingExpand === pr.id;

                return (
                  <Fragment key={pr.id}>
                    {/* Main row */}
                    <tr
                      onClick={() => handleRowClick(pr.id)}
                      className={`border-b border-slate-100 cursor-pointer transition-colors select-none ${
                        isExpanded
                          ? "bg-blue-50 border-blue-100"
                          : "hover:bg-slate-50"
                      }`}
                    >
                      <td className="px-3 py-3 text-slate-400">
                        {isExpanded
                          ? <ChevronDown size={15} />
                          : <ChevronRight size={15} />}
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-mono text-xs font-bold text-blue-600">
                          {pr.pr_number}
                        </div>
                        <div className="text-[11px] text-slate-400">{formatDate(pr.created_at)}</div>
                        {pr.is_urgent && (
                          <span className="text-[10px] font-semibold text-red-600">⚡ ด่วน</span>
                        )}
                      </td>
                      <td className="px-4 py-3 max-w-[220px]">
                        <div className="font-medium text-slate-800 truncate">{pr.title}</div>
                        <div className="text-xs text-slate-400">
                          {pr.profiles?.full_name ?? "—"}
                        </div>
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell">
                        <ProgressDots prStatus={pr.status} pos={pos} />
                      </td>
                      <td className="px-4 py-3 text-center">
                        <StatusBadge kind="pr" status={pr.status} />
                      </td>
                      <td className="px-4 py-3 text-center hidden lg:table-cell">
                        {primaryPO ? (
                          <StatusBadge kind="po" status={primaryPO.status} />
                        ) : (
                          <span className="text-xs text-slate-300">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-slate-800">
                        {formatCurrency(pr.total_amount)}
                      </td>
                    </tr>

                    {/* Expanded detail row */}
                    {isExpanded && (
                      <tr className="bg-blue-50/60 border-b border-blue-100">
                        <td colSpan={7} className="px-4 pb-4 pt-1">
                          {isLoading ? (
                            <div className="py-3 text-center text-sm text-slate-400">
                              กำลังโหลด...
                            </div>
                          ) : (
                            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                              {/* รายการสินค้า */}
                              <div className="rounded-lg border border-slate-200 bg-white p-3">
                                <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-slate-400">
                                  รายการสินค้า
                                </p>
                                {items.length === 0 ? (
                                  <p className="text-xs text-slate-400">ไม่มีรายการ</p>
                                ) : (
                                  <ul className="space-y-1.5">
                                    {items.slice(0, 3).map(it => (
                                      <li key={it.id} className="flex items-baseline justify-between gap-2">
                                        <span className="text-xs text-slate-600 truncate flex-1">
                                          {it.line_no}. {it.description}
                                        </span>
                                        <span className="text-[11px] text-slate-400 shrink-0">
                                          ×{Number(it.quantity).toLocaleString("th-TH")} {it.unit}
                                        </span>
                                      </li>
                                    ))}
                                    {items.length >= 4 && (
                                      <li className="text-[11px] text-slate-400">
                                        และอีกหลายรายการ...
                                      </li>
                                    )}
                                  </ul>
                                )}
                              </div>

                              {/* PO info */}
                              <div className="rounded-lg border border-slate-200 bg-white p-3">
                                <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-slate-400">
                                  ใบสั่งซื้อ (PO)
                                </p>
                                {primaryPO ? (
                                  <div className="space-y-1.5">
                                    <div className="font-mono text-xs font-bold text-slate-700">
                                      {primaryPO.po_number}
                                    </div>
                                    {primaryPO.vendor_name && (
                                      <div className="text-xs text-slate-500">
                                        {primaryPO.vendor_name}
                                      </div>
                                    )}
                                    <StatusBadge kind="po" status={primaryPO.status} />
                                    <div className="text-xs font-semibold text-slate-700">
                                      {formatCurrency(primaryPO.total_amount)}
                                    </div>
                                  </div>
                                ) : (
                                  <p className="text-xs text-slate-400">
                                    {pr.status === "approved"
                                      ? "✅ อนุมัติแล้ว รอสร้าง PO"
                                      : "ยังไม่มีใบสั่งซื้อ"}
                                  </p>
                                )}
                              </div>

                              {/* Actions */}
                              <div className="rounded-lg border border-slate-200 bg-white p-3 flex flex-col justify-between gap-2">
                                <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">
                                  ดำเนินการ
                                </p>
                                <div className="space-y-2">
                                  <Link
                                    href={`/requisitions/${pr.id}`}
                                    onClick={e => e.stopPropagation()}
                                    className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-xs font-medium text-white transition hover:bg-blue-700"
                                  >
                                    ดูรายละเอียด →
                                  </Link>
                                  {pr.status === "approved" && !primaryPO && (
                                    <Link
                                      href={`/requisitions/${pr.id}`}
                                      onClick={e => e.stopPropagation()}
                                      className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-xs font-medium text-green-700 transition hover:bg-green-100"
                                    >
                                      + สร้าง PO
                                    </Link>
                                  )}
                                </div>
                              </div>
                            </div>
                          )}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
