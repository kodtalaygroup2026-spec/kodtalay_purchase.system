"use client";

import { useState, Fragment } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
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

// 3 steps: ใบขอซื้อ → รออนุมัติ → ดำเนินการ
function getStepState(
  idx: number,
  prStatus: PrStatus,
  hasPO: boolean,
): StepState {
  const s = prStatus as string;
  const isTerminal = s === "cancelled" || s === "paid";
  const isPastApproval = s === "approved" || s === "converted" || s === "pending_finance" || s === "paid" || hasPO;
  const isPastSubmit = s === "submitted" || s === "pending_second_approval" || isPastApproval;

  if (idx === 0) {
    if (s === "rejected" || s === "cancelled") return "error";
    if (isPastSubmit) return "done";
    return "current";
  }
  if (idx === 1) {
    if (s === "rejected") return "error";
    if (isPastApproval) return "done";
    if (s === "submitted" || s === "pending_second_approval") return "current";
    return "locked";
  }
  // idx === 2: ดำเนินการ
  if (isTerminal) return "done";
  if (isPastApproval) return "current";
  return "locked";
}

// ── Progress dots ──────────────────────────────────────────────────────────

function ProgressDots({ prStatus, pos }: { prStatus: PrStatus; pos: LinkedPO[] }) {
  const hasPO = pos.length > 0;

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
      {[0, 1, 2].map(i => {
        const state = getStepState(i, prStatus, hasPO);
        return (
          <Fragment key={i}>
            <div className={`h-2.5 w-2.5 rounded-sm ${dotColor(state)}`} />
            {i < 2 && <div className={`h-0.5 w-3 ${lineColor(state)}`} />}
          </Fragment>
        );
      })}
    </div>
  );
}

// ── Progress summary bar ───────────────────────────────────────────────────

// statuses ที่โชว์ใน dropdown เมื่อเลือก step (ใช้เป็น Set เพื่อ filter)
export const STEP_STATUSES: PrStatus[][] = [
  ["draft", "returned", "rejected"],             // ใบขอซื้อ
  ["submitted", "pending_second_approval"],       // รออนุมัติ
  ["approved", "converted"],                      // ดำเนินการ
  // หมายเหตุ: cancelled, pending_finance, paid ไม่อยู่ใน step ใด → โชว์เฉพาะ "งานเอกสาร" (ไม่กรอง)
];

const SUMMARY_STEPS = [
  {
    label: "ใบขอซื้อ",
    sub: "ร่าง / ตีกลับ",
    color: "text-slate-600",
    bg: "bg-slate-50",
    dot: "bg-slate-400",
    match: (pr: PRRow) => {
      const s = pr.status as string;
      return s === "draft" || s === "returned" || s === "rejected";
    },
  },
  {
    label: "รออนุมัติ",
    sub: "ส่งแล้ว",
    color: "text-amber-700",
    bg: "bg-amber-50",
    dot: "bg-amber-400",
    match: (pr: PRRow) => {
      const s = pr.status as string;
      return s === "submitted" || s === "pending_second_approval";
    },
  },
  {
    label: "ดำเนินการ",
    sub: "อนุมัติแล้ว",
    color: "text-green-700",
    bg: "bg-green-50",
    dot: "bg-green-500",
    match: (pr: PRRow) => {
      const s = pr.status as string;
      return s === "approved" || s === "converted" || pr.purchase_orders.length > 0;
    },
  },
];

function ProgressSummary({
  prs,
  activeStep,
  onStep,
}: {
  prs: PRRow[];
  activeStep: number | null;
  onStep: (i: number) => void;
}) {
  const counts = SUMMARY_STEPS.map((s) => prs.filter(s.match).length);
  return (
    <div className="flex overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      {SUMMARY_STEPS.map((step, i) => {
        const isActive = activeStep === i;
        return (
          <button
            key={step.label}
            onClick={() => onStep(i)}
            className={`relative flex flex-1 flex-col items-center justify-center gap-0.5 px-3 py-3 text-center transition-colors ${
              isActive ? step.bg + " ring-inset ring-2 ring-blue-400" : "bg-white hover:" + step.bg
            } ${i < SUMMARY_STEPS.length - 1 ? "border-r border-slate-200" : ""}`}
          >
            {/* Badge มุมขวาบน */}
            {counts[i] > 0 && (
              <span className={`absolute right-2 top-1.5 rounded-full px-1.5 py-0.5 text-[10px] font-bold tabular-nums text-white ${step.dot}`}>
                {counts[i]}
              </span>
            )}
            <span className={`h-2 w-2 rounded-full ${step.dot} shrink-0`} />
            <span className={`text-xs font-semibold leading-tight ${step.color}`}>
              {step.label}
            </span>
            <span className="text-[10px] text-slate-400 hidden sm:block">{step.sub}</span>
            {isActive && (
              <span className="mt-0.5 text-[9px] font-semibold text-blue-500">● กำลังดู</span>
            )}
          </button>
        );
      })}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────

export function RequisitionList({ prs, initialStep = null }: { prs: PRRow[]; initialStep?: number | null }) {
  const supabase = createClient();
  const router = useRouter();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<PrStatus | "">("");
  const [activeStep, setActiveStep] = useState<number | null>(initialStep);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [expandedItems, setExpandedItems] = useState<Record<string, ExpandedItem[]>>({});
  const [loadingExpand, setLoadingExpand] = useState<string | null>(null);

  function handleStepClick(i: number) {
    setActiveStep(prev => (prev === i ? null : i));
    setStatusFilter("");
    setSearch("");
  }

  // ── Filter ───────────────────────────────────────────────────────────────
  const filtered = prs.filter(pr => {
    const q = search.toLowerCase();
    const matchSearch =
      !q ||
      pr.pr_number.toLowerCase().includes(q) ||
      pr.title.toLowerCase().includes(q) ||
      (pr.profiles?.full_name ?? "").toLowerCase().includes(q);
    const matchStatus = !statusFilter || pr.status === statusFilter;
    const matchStep = activeStep === null || SUMMARY_STEPS[activeStep].match(pr);
    return matchSearch && matchStatus && matchStep;
  });

  // คลิกแถว = ไปหน้ารายละเอียด
  function handleRowClick(prId: string) {
    router.push(`/requisitions/${prId}`);
  }

  // คลิก chevron = expand/collapse ข้อมูลย่อ (stopPropagation ไม่ให้ navigate)
  async function handleChevronClick(e: React.MouseEvent, prId: string) {
    e.stopPropagation();
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
      {/* ── Progress summary ─────────────────────────────────────────────── */}
      <ProgressSummary prs={prs} activeStep={activeStep} onStep={handleStepClick} />

      {/* ── Filter bar ───────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={e => { setSearch(e.target.value); setActiveStep(null); }}
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
          onChange={e => { setStatusFilter(e.target.value as PrStatus | ""); }}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 focus:border-blue-500 focus:outline-none"
        >
          <option value="">สถานะทั้งหมด</option>
          {(activeStep !== null
            ? STEP_STATUSES[activeStep]
            : (Object.keys(PR_STATUS_LABELS) as PrStatus[])
          ).map(val => (
            <option key={val} value={val}>{PR_STATUS_LABELS[val]}</option>
          ))}
        </select>

        {(search || statusFilter) && (
          <button
            onClick={() => { setSearch(""); setStatusFilter(""); setActiveStep(null); }}
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
                <th className="w-8 px-3 py-3" />
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
                      <td className="px-3 py-3 text-slate-400">
                        <button
                          onClick={(e) => handleChevronClick(e, pr.id)}
                          className="rounded p-0.5 hover:bg-slate-200 transition-colors"
                        >
                          {isExpanded
                            ? <ChevronDown size={15} />
                            : <ChevronRight size={15} />}
                        </button>
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
                            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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
