"use client";

import { useState, Fragment } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { ChevronDown, Search, X, FileText, Settings2, Clock, ImagePlus, Banknote } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/utils/format";
import { PR_STATUS_LABELS } from "@/lib/constants";
import { StatusBadge } from "@/components/ui/StatusBadge";
import type { PrStatus, PoStatus } from "@/types/database";

// ── Branch badge colors (keyed by branch code) ────────────────────────────
const BRANCH_BADGE: Record<string, string> = {
  BN:  "bg-blue-600 text-white",
  CK:  "bg-red-600 text-white",
  RCA: "bg-emerald-600 text-white",
};

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
  branch_code: string | null;
  title: string;
  status: PrStatus;
  total_amount: number;
  created_at: string;
  needed_by: string | null;
  is_urgent: boolean;
  payment_returned: boolean;
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

// ── Step state helper (ใช้ในตาราง Progress column เดิม — ถูก comment เพราะเปลี่ยนเป็นตารางใหม่) ──
/*
type StepState = "done" | "current" | "error" | "locked";

function getStepState(idx: number, prStatus: PrStatus, hasPO: boolean): StepState {
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
  if (isTerminal) return "done";
  if (isPastApproval) return "current";
  return "locked";
}

function ProgressDots({ prStatus, pos }: { prStatus: PrStatus; pos: LinkedPO[] }) {
  const hasPO = pos.length > 0;
  const dotColor = (state: StepState) => {
    if (state === "done") return "bg-green-500";
    if (state === "current") return "bg-blue-500";
    if (state === "error") return "bg-red-400";
    return "bg-slate-200";
  };
  const lineColor = (state: StepState) => state === "done" ? "bg-green-300" : "bg-slate-200";
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
*/

// ── Progress summary bar ───────────────────────────────────────────────────

// statuses ที่โชว์ใน dropdown เมื่อเลือก step (ใช้เป็น Set เพื่อ filter)
export const STEP_STATUSES: PrStatus[][] = [
  ["draft", "returned", "rejected"],             // A1: ร่าง/รอแก้ไข
  ["submitted", "pending_second_approval"],       // A2: รออนุมัติ
  ["approved", "converted"],                      // A3: แนบบิล+รับของ
  ["pending_finance"],                            // A4: รอตั้งจ่าย
];

const SUMMARY_STEPS = [
  {
    label: "ร่าง / รอแก้ไข",
    subEn: "draft / editable",
    iconBg: "bg-amber-100",
    iconColor: "text-amber-500",
    subIconBg: "bg-amber-500",
    badgeBg: "bg-amber-500",
    activeBorder: "ring-amber-400",
    activeBg: "bg-amber-50",
    SubIcon: Settings2,
    match: (pr: PRRow) => {
      const s = pr.status as string;
      return s === "draft" || s === "returned" || s === "rejected";
    },
  },
  {
    label: "รออนุมัติ",
    subEn: "pending approval",
    iconBg: "bg-blue-100",
    iconColor: "text-blue-500",
    subIconBg: "bg-blue-500",
    badgeBg: "bg-blue-500",
    activeBorder: "ring-blue-400",
    activeBg: "bg-blue-50",
    SubIcon: Clock,
    match: (pr: PRRow) => {
      const s = pr.status as string;
      return s === "submitted" || s === "pending_second_approval";
    },
  },
  {
    label: "แนบบิล + รับของ",
    subEn: "add bill & photo",
    iconBg: "bg-emerald-100",
    iconColor: "text-emerald-500",
    subIconBg: "bg-emerald-500",
    badgeBg: "bg-emerald-500",
    activeBorder: "ring-emerald-400",
    activeBg: "bg-emerald-50",
    SubIcon: ImagePlus,
    match: (pr: PRRow) => {
      const s = pr.status as string;
      // PR ที่ถูกตีกลับการจ่ายให้ไปนับในขั้น "รอตั้งจ่าย" แทน
      return (s === "approved" || s === "converted") && !pr.payment_returned;
    },
  },
  {
    label: "รอตั้งจ่าย",
    subEn: "pending payment",
    iconBg: "bg-violet-100",
    iconColor: "text-violet-500",
    subIconBg: "bg-violet-500",
    badgeBg: "bg-violet-500",
    activeBorder: "ring-violet-400",
    activeBg: "bg-violet-50",
    SubIcon: Banknote,
    match: (pr: PRRow) => {
      const s = pr.status as string;
      // รวม PR ที่ถูกฝ่ายบัญชีตีกลับ (รอผู้สร้างแก้หลักฐานแล้วส่งกลับเข้าจ่าย)
      return s === "pending_finance" || pr.payment_returned;
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
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {SUMMARY_STEPS.map((step, i) => {
        const isActive = activeStep === i;
        const { SubIcon } = step;
        return (
          <button
            key={step.label}
            onClick={() => onStep(i)}
            className={`relative flex flex-col items-center gap-3 rounded-2xl border-2 px-3 py-5 text-center transition-all hover:shadow-md ${
              isActive
                ? `${step.activeBg} border-transparent ring-2 ${step.activeBorder} shadow-md`
                : "border-transparent bg-white shadow-sm hover:border-slate-100"
            }`}
          >
            {/* Count badge มุมขวาบน */}
            {counts[i] > 0 && (
              <span className={`absolute right-2.5 top-2.5 flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[10px] font-bold text-white ${step.badgeBg}`}>
                {counts[i]}
              </span>
            )}

            {/* Icon composition — document + sub-icon badge */}
            <div className="relative mt-1">
              <div className={`flex h-[60px] w-[60px] items-center justify-center rounded-[18px] ${step.iconBg}`}>
                <FileText size={32} className={step.iconColor} strokeWidth={1.5} />
              </div>
              <div className={`absolute -bottom-1.5 -right-1.5 flex h-6 w-6 items-center justify-center rounded-lg shadow ${step.subIconBg}`}>
                <SubIcon size={13} className="text-white" strokeWidth={2.5} />
              </div>
            </div>

            {/* Label */}
            <div className="space-y-0.5">
              <p className="text-xs font-bold text-slate-800 leading-tight">{step.label}</p>
              <p className="text-[10px] text-slate-400 leading-tight">{step.subEn}</p>
            </div>

            {isActive && (
              <span className="text-[10px] font-semibold text-blue-500">● กำลังดู</span>
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

  // คลิกปุ่ม ดู▾ = expand/collapse dropdown รายการสินค้า
  async function handleChevronClick(e: React.MouseEvent, prId: string) {
    e.stopPropagation();
    if (expandedId === prId) {
      setExpandedId(null);
      return;
    }
    setExpandedId(prId);
    if (!expandedItems[prId]) {
      setLoadingExpand(prId);
      const [{ data: itemsData }, { data: editLogs }] = await Promise.all([
        supabase
          .from("pr_items")
          .select("id, line_no, description, quantity, unit, unit_price")
          .eq("pr_id", prId)
          .order("line_no")
          .limit(6),
        (supabase as any)
          .from("pr_item_edit_logs")
          .select("changes")
          .eq("pr_id", prId)
          .order("edited_at", { ascending: true }),
      ]);

      // apply edit logs ทับราคาเก่าใน pr_items (รองรับกรณี pr_items ยังไม่ถูก update)
      let items: ExpandedItem[] = (itemsData ?? []) as ExpandedItem[];
      for (const log of (editLogs ?? []) as any[]) {
        const changeMap = new Map(
          (log.changes as any[]).map((c: any) => [c.item_id, c])
        );
        items = items.map((item) => {
          const ch = changeMap.get(item.id);
          if (!ch) return item;
          return {
            ...item,
            quantity: ch.quantity_new,
            unit_price: ch.unit_price_new,
          };
        });
      }

      setExpandedItems(prev => ({ ...prev, [prId]: items }));
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
          <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="border-b border-slate-100 bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-slate-500">เลขที่ PR</th>
                <th className="px-4 py-3 text-left font-medium text-slate-500 whitespace-nowrap">วันที่</th>
                <th className="px-4 py-3 text-left font-medium text-slate-500">สาขา</th>
                <th className="px-4 py-3 text-left font-medium text-slate-500">ชื่อ / ผู้ขอ</th>
                <th className="px-4 py-3 text-left font-medium text-slate-500">สถานะ</th>
                <th className="px-4 py-3 text-right font-medium text-slate-500 whitespace-nowrap">จำนวนเงิน</th>
                <th className="w-20 px-3 py-3" />
              </tr>
            </thead>
            <tbody>
              {filtered.map(pr => {
                const isExpanded = expandedId === pr.id;
                const items = expandedItems[pr.id] ?? [];
                const isLoading = loadingExpand === pr.id;
                const visibleItems = items.slice(0, 5);
                const remainingCount = items.length > 5 ? items.length - 5 : 0;

                return (
                  <Fragment key={pr.id}>
                    {/* Main row */}
                    <tr
                      className={`border-b border-slate-100 transition-colors select-none ${
                        isExpanded ? "bg-blue-50/60 border-blue-100" : "hover:bg-slate-50"
                      }`}
                    >
                      {/* เลขที่ PR */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono text-xs font-bold text-blue-700">{pr.pr_number}</span>
                          {pr.is_urgent && (
                            <span className="rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-bold text-red-600">
                              ⚡ ด่วน
                            </span>
                          )}
                        </div>
                      </td>

                      {/* วันที่ */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="text-xs text-slate-500">{formatDate(pr.created_at)}</span>
                      </td>

                      {/* สาขา */}
                      <td className="px-4 py-3">
                        {pr.branch_code ? (
                          <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-bold ${BRANCH_BADGE[pr.branch_code] ?? "bg-slate-500 text-white"}`}>
                            {pr.branch_code}
                          </span>
                        ) : (
                          <span className="text-xs text-slate-300">—</span>
                        )}
                      </td>

                      {/* ชื่อ / ผู้ขอ */}
                      <td className="px-4 py-3 max-w-[220px]">
                        <div className="font-medium text-slate-800 truncate">{pr.title}</div>
                        <div className="text-xs text-slate-400 truncate">{pr.profiles?.full_name ?? "—"}</div>
                      </td>

                      {/* สถานะ */}
                      <td className="px-4 py-3">
                        {pr.payment_returned ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-700">
                            ↩️ ตีกลับ—แก้หลักฐาน
                          </span>
                        ) : (
                          <StatusBadge kind="pr" status={pr.status} />
                        )}
                      </td>

                      {/* จำนวนเงิน */}
                      <td className="px-4 py-3 text-right font-semibold text-slate-800 whitespace-nowrap">
                        {formatCurrency(pr.total_amount)}
                      </td>

                      {/* ปุ่มดู */}
                      <td className="px-3 py-3 text-center" onClick={e => e.stopPropagation()}>
                        <button
                          onClick={(e) => handleChevronClick(e, pr.id)}
                          className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors ${
                            isExpanded
                              ? "border-blue-200 bg-blue-100 text-blue-700"
                              : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50"
                          }`}
                        >
                          ดู
                          <ChevronDown
                            size={12}
                            className={`transition-transform ${isExpanded ? "rotate-180" : ""}`}
                          />
                        </button>
                      </td>
                    </tr>

                    {/* Expanded dropdown row */}
                    {isExpanded && (
                      <tr className="border-b border-blue-100 bg-blue-50/30">
                        <td colSpan={7} className="px-4 pb-4 pt-2">
                          {isLoading ? (
                            <div className="py-4 text-center text-sm text-slate-400">กำลังโหลด...</div>
                          ) : (
                            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                              {/* รายการสินค้า */}
                              {visibleItems.length === 0 ? (
                                <div className="px-4 py-3 text-xs text-slate-400">ไม่มีรายการสินค้า</div>
                              ) : (
                                <ul className="divide-y divide-slate-50">
                                  {visibleItems.map(it => (
                                    <li key={it.id} className="flex items-baseline justify-between gap-3 px-4 py-2.5">
                                      <div className="flex min-w-0 items-baseline gap-2">
                                        <span className="shrink-0 text-[11px] font-medium text-slate-400">{it.line_no}.</span>
                                        <span className="truncate text-sm text-slate-700">{it.description}</span>
                                      </div>
                                      <div className="flex shrink-0 items-baseline gap-3">
                                        <span className="text-xs text-slate-400">
                                          ×{Number(it.quantity).toLocaleString("th-TH")} {it.unit}
                                        </span>
                                        <span className="whitespace-nowrap text-xs font-medium text-slate-600">
                                          {formatCurrency(Number(it.unit_price) * Number(it.quantity))}
                                        </span>
                                      </div>
                                    </li>
                                  ))}
                                </ul>
                              )}

                              {/* อีก N รายการ */}
                              {remainingCount > 0 && (
                                <div className="border-t border-slate-100 px-4 py-2 text-xs text-slate-400">
                                  ··· อีก {remainingCount} รายการ
                                </div>
                              )}

                              {/* ลิงก์ไปหน้ารายละเอียด */}
                              <div className="border-t border-slate-100 px-4 py-2.5">
                                <button
                                  onClick={() => handleRowClick(pr.id)}
                                  className="text-xs font-medium text-blue-600 hover:text-blue-700 hover:underline"
                                >
                                  → ดูรายละเอียดทั้งหมด
                                </button>
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
        </div>
      )}
    </div>
  );
}
