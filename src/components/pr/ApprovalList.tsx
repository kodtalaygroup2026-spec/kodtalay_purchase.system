"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import { CheckCircle, CheckSquare, Square, ChevronUp, ChevronDown, ChevronsUpDown, RotateCcw, XCircle, X, Filter } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/utils/format";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { externalBrowserLink } from "@/lib/line/externalLink";
import { useCurrentUserName } from "@/hooks/useCurrentUserName";
import type { PrStatus } from "@/types/database";

export interface PRApprovalRow {
  id: string;
  pr_number: string;
  title: string;
  status: PrStatus;
  total_amount: number;
  created_at: string;
  requester_id: string;
  requester_name: string;
  requester_line_id: string | null;
  department: string | null;
  branch_name: string | null;
}

type SortKey = "pr_number" | "title" | "requester_name" | "department" | "created_at" | "total_amount";
type SortDir = "asc" | "desc";

interface ApprovalListProps {
  prs: PRApprovalRow[];
  currentUserId: string;
}

// ── Sort helper ──────────────────────────────────────────────────────────────

function sortPRs(prs: PRApprovalRow[], key: SortKey, dir: SortDir): PRApprovalRow[] {
  return [...prs].sort((a, b) => {
    let av: string | number = a[key] ?? "";
    let bv: string | number = b[key] ?? "";
    if (key === "total_amount") {
      av = Number(av);
      bv = Number(bv);
    } else {
      av = String(av).toLowerCase();
      bv = String(bv).toLowerCase();
    }
    if (av < bv) return dir === "asc" ? -1 : 1;
    if (av > bv) return dir === "asc" ? 1 : -1;
    return 0;
  });
}

// ── SortTh — sortable column header ─────────────────────────────────────────

function SortTh({
  label,
  col,
  active,
  dir,
  onSort,
  className = "",
  search,
}: {
  label: string;
  col: SortKey;
  active: SortKey;
  dir: SortDir;
  onSort: (col: SortKey) => void;
  className?: string;
  /** ช่องค้นหาแบบเจาะจง — แทรกใต้ป้ายชื่อในหัวคอลัมน์เดียวกัน */
  search?: React.ReactNode;
}) {
  const isActive = active === col;
  return (
    <th className={`px-4 py-3 align-top ${className}`}>
      <button
        onClick={() => onSort(col)}
        className="flex items-center gap-1 font-medium text-slate-500 hover:text-slate-700 group"
      >
        {label}
        <span className={`transition ${isActive ? "text-blue-500" : "text-slate-300 group-hover:text-slate-400"}`}>
          {isActive
            ? dir === "asc" ? <ChevronUp size={13} /> : <ChevronDown size={13} />
            : <ChevronsUpDown size={13} />}
        </span>
      </button>
      {search && <div className="mt-1.5">{search}</div>}
    </th>
  );
}

// ── Main component ───────────────────────────────────────────────────────────

export function ApprovalList({ prs, currentUserId }: ApprovalListProps) {
  const router = useRouter();
  const supabase = createClient();
  const actorName = useCurrentUserName(currentUserId);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>("created_at");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [pendingBulk, setPendingBulk] = useState<"return" | "reject" | null>(null);
  const [bulkNote, setBulkNote] = useState("");

  // ── ค้นหาแบบเจาะจงรายคอลัมน์ (กรองเฉพาะบนหน้าจอ ไม่แตะข้อมูล) ─────────────
  const EMPTY_COL_FILTERS = {
    pr_number: "",
    title: "",
    department: "",
    amountMin: "",
    amountMax: "",
  };
  const [showColumnSearch, setShowColumnSearch] = useState(false);
  const [colFilters, setColFilters] = useState(EMPTY_COL_FILTERS);

  const activeFilterCount = Object.values(colFilters).filter((v) => v.trim() !== "").length;

  function setColFilter(key: keyof typeof EMPTY_COL_FILTERS, value: string) {
    setColFilters((prev) => ({ ...prev, [key]: value }));
  }

  // ปิดแถบค้นหา = ล้างเงื่อนไขด้วย กันกรองค้างแบบมองไม่เห็น
  function toggleColumnSearch() {
    setShowColumnSearch((open) => {
      if (open) setColFilters(EMPTY_COL_FILTERS);
      return !open;
    });
  }

  function handleSort(col: SortKey) {
    if (col === sortKey) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(col); setSortDir("asc"); }
  }

  const filtered = useMemo(() => {
    if (activeFilterCount === 0) return prs;
    const prNo = colFilters.pr_number.trim().toLowerCase();
    const name = colFilters.title.trim().toLowerCase();
    const dept = colFilters.department.trim().toLowerCase();
    const min = parseFloat(colFilters.amountMin);
    const max = parseFloat(colFilters.amountMax);

    return prs.filter((pr) => {
      if (prNo && !pr.pr_number.toLowerCase().includes(prNo)) return false;
      if (name && !pr.title.toLowerCase().includes(name) && !pr.requester_name.toLowerCase().includes(name)) return false;
      if (dept && !(pr.department ?? "").toLowerCase().includes(dept)) return false;
      if (!Number.isNaN(min) && Number(pr.total_amount) < min) return false;
      if (!Number.isNaN(max) && Number(pr.total_amount) > max) return false;
      return true;
    });
  }, [prs, colFilters, activeFilterCount]);

  const sorted = sortPRs(filtered, sortKey, sortDir);
  // เลือกทั้งหมด = เฉพาะรายการที่มองเห็นอยู่ (หลังกรอง)
  const allSelected = sorted.length > 0 && sorted.every((pr) => selected.has(pr.id));

  function toggleAll() {
    if (allSelected) setSelected(new Set());
    else setSelected(new Set(sorted.map((pr) => pr.id)));
  }

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function sendLineNotify(lineUserId: string, message: string) {
    try {
      await fetch("/api/notifications/line", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lineUserId, message }),
      });
    } catch { /* ไม่ block flow หลัก */ }
  }

  async function handleBulkApprove() {
    if (selected.size === 0 || isLoading) return;
    setIsLoading(true);

    const now = new Date().toISOString();
    const ids = [...selected];

    const { error } = await (supabase as any)
      .from("purchase_requisitions")
      .update({ status: "approved", approved_at: now, approved_by: currentUserId })
      .in("id", ids)
      .eq("status", "submitted");

    if (!error) {
      const origin = window.location.origin;
      for (const pr of prs.filter((p) => ids.includes(p.id))) {
        if (pr.requester_line_id) {
          void sendLineNotify(
            pr.requester_line_id,
            `✅ แจ้งผลการพิจารณา : ใบขอซื้อได้รับการอนุมัติ\n\n` +
            `เลขที่เอกสาร : ${pr.pr_number}\nสาขา : ${pr.branch_name ?? "—"}\n` +
            `รายการ : ${pr.title}\n` +
            `จำนวนเงิน : ${formatCurrency(pr.total_amount)}\n` +
            `อนุมัติโดย : ${actorName || "—"}\n\n` +
            `ท่านสามารถดำเนินการในขั้นตอนถัดไปได้\n` +
            `รายละเอียด : ${externalBrowserLink(`${origin}/requisitions/${pr.id}`)}`
          );
        }
      }
      setSelected(new Set());
      router.refresh();
    }

    setIsLoading(false);
  }

  async function handleBulkConfirm() {
    if (!pendingBulk || !bulkNote.trim() || selected.size === 0 || isLoading) return;
    setIsLoading(true);

    const now = new Date().toISOString();
    const ids = [...selected];

    const isReturn = pendingBulk === "return";
    const newStatus = isReturn ? "returned" : "rejected";
    const update = {
      status: newStatus,
      rejected_at: now,
      rejected_by: currentUserId,
      rejection_reason: bulkNote.trim(),
    };

    const { error } = await (supabase as any)
      .from("purchase_requisitions")
      .update(update)
      .in("id", ids)
      .eq("status", "submitted");

    if (!error) {
      const origin = window.location.origin;
      const header = isReturn
        ? "🔄 แจ้งเตือน : ใบขอซื้อถูกส่งกลับเพื่อแก้ไข"
        : "❌ แจ้งผลการพิจารณา : ใบขอซื้อไม่ได้รับการอนุมัติ";
      const actionLine = isReturn ? "กรุณาแก้ไขข้อมูลและส่งขออนุมัติอีกครั้ง\n" : "";
      for (const pr of prs.filter((p) => ids.includes(p.id))) {
        if (pr.requester_line_id) {
          void sendLineNotify(
            pr.requester_line_id,
            `${header}\n\n` +
            `เลขที่เอกสาร : ${pr.pr_number}\nสาขา : ${pr.branch_name ?? "—"}\n` +
            `รายการ : ${pr.title}\n` +
            `ดำเนินการโดย : ${actorName || "—"}\n` +
            `เหตุผล : ${bulkNote.trim()}\n\n` +
            `${actionLine}รายละเอียด : ${externalBrowserLink(`${origin}/requisitions/${pr.id}`)}`
          );
        }
      }
      setSelected(new Set());
      setPendingBulk(null);
      setBulkNote("");
      router.refresh();
    }

    setIsLoading(false);
  }

  function cancelBulk() {
    setPendingBulk(null);
    setBulkNote("");
  }

  return (
    <div className="space-y-3">
      {/* ── Bulk action bar ─────────────────────────────────────────────────── */}
      {selected.size > 0 && (
        <div className={`rounded-xl border px-4 py-3 shadow-sm space-y-3 ${
          pendingBulk === "reject" ? "border-red-200 bg-red-50"
          : pendingBulk === "return" ? "border-orange-200 bg-orange-50"
          : "border-green-200 bg-green-50"
        }`}>
          {/* Row 1: label + action buttons */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className={`text-sm font-medium ${
              pendingBulk === "reject" ? "text-red-700"
              : pendingBulk === "return" ? "text-orange-700"
              : "text-green-700"
            }`}>
              เลือก {selected.size} รายการ
            </span>

            {!pendingBulk ? (
              <div className="flex flex-wrap items-center gap-2">
                {/* อนุมัติ */}
                <button
                  onClick={handleBulkApprove}
                  disabled={isLoading}
                  className="flex items-center gap-1.5 rounded-lg bg-green-600 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-green-700 disabled:opacity-60"
                >
                  <CheckCircle size={14} />
                  {isLoading ? "กำลังดำเนินการ..." : `อนุมัติ ${selected.size} รายการ`}
                </button>
                {/* ตีกลับ */}
                <button
                  onClick={() => setPendingBulk("return")}
                  disabled={isLoading}
                  className="flex items-center gap-1.5 rounded-lg bg-orange-500 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-orange-600 disabled:opacity-60"
                >
                  <RotateCcw size={14} />
                  ตีกลับ
                </button>
                {/* ไม่อนุมัติ */}
                <button
                  onClick={() => setPendingBulk("reject")}
                  disabled={isLoading}
                  className="flex items-center gap-1.5 rounded-lg bg-red-600 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-red-700 disabled:opacity-60"
                >
                  <XCircle size={14} />
                  ไม่อนุมัติ
                </button>
              </div>
            ) : (
              <button
                onClick={cancelBulk}
                disabled={isLoading}
                className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700"
              >
                <X size={14} /> ยกเลิก
              </button>
            )}
          </div>

          {/* Row 2: note input เมื่อเลือก ตีกลับ / ไม่อนุมัติ */}
          {pendingBulk && (
            <div className="space-y-2">
              <label className="block text-sm font-medium text-slate-700">
                เหตุผล <span className="text-red-500">*</span>
                <span className="ml-1 text-xs font-normal text-slate-400">
                  ({pendingBulk === "return" ? "ตีกลับ" : "ไม่อนุมัติ"} {selected.size} รายการ)
                </span>
              </label>
              <textarea
                value={bulkNote}
                onChange={(e) => setBulkNote(e.target.value)}
                rows={2}
                placeholder="ระบุเหตุผล..."
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              />
              <button
                onClick={handleBulkConfirm}
                disabled={isLoading || !bulkNote.trim()}
                className={`flex items-center gap-2 rounded-lg px-4 py-1.5 text-sm font-medium text-white transition disabled:opacity-60 ${
                  pendingBulk === "return"
                    ? "bg-orange-500 hover:bg-orange-600"
                    : "bg-red-600 hover:bg-red-700"
                }`}
              >
                {pendingBulk === "return" ? <RotateCcw size={14} /> : <XCircle size={14} />}
                {isLoading ? "กำลังดำเนินการ..." : pendingBulk === "return" ? `ตีกลับ ${selected.size} รายการ` : `ไม่อนุมัติ ${selected.size} รายการ`}
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── ปุ่มเปิดค้นหาแบบเจาะจง + สรุปผลกรอง ─────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <button
          onClick={toggleColumnSearch}
          className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
            showColumnSearch
              ? "border-blue-400 bg-blue-50 text-blue-700"
              : "border-slate-200 bg-white text-slate-500 hover:border-slate-300"
          }`}
        >
          <Filter size={13} />
          ค้นหาแบบเจาะจง
          {activeFilterCount > 0 && (
            <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-blue-600 px-1 text-[10px] font-bold text-white">
              {activeFilterCount}
            </span>
          )}
        </button>
        {activeFilterCount > 0 && (
          <span className="text-xs text-slate-400">
            พบ {sorted.length} จาก {prs.length} รายการ
          </span>
        )}
      </div>

      {/* ── Table ───────────────────────────────────────────────────────────── */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="border-b border-slate-100 bg-slate-50">
            <tr>
              <th className="px-4 py-3 text-left w-10">
                <button onClick={toggleAll} className="flex items-center">
                  {allSelected
                    ? <CheckSquare size={16} className="text-blue-600" />
                    : <Square size={16} className="text-slate-400" />}
                </button>
              </th>
              <SortTh
                label="เลขที่ PR"
                col="pr_number"
                active={sortKey} dir={sortDir} onSort={handleSort}
                search={showColumnSearch && (
                  <input
                    value={colFilters.pr_number}
                    onChange={(e) => setColFilter("pr_number", e.target.value)}
                    placeholder="เช่น 0006"
                    className="h-8 w-full min-w-[90px] rounded-md border border-slate-200 px-2 text-xs font-normal placeholder:text-slate-300 focus:border-blue-400 focus:outline-none"
                  />
                )}
              />
              <SortTh
                label="ชื่อ / ผู้ขอ"
                col="title"
                active={sortKey} dir={sortDir} onSort={handleSort}
                search={showColumnSearch && (
                  <input
                    value={colFilters.title}
                    onChange={(e) => setColFilter("title", e.target.value)}
                    placeholder="ชื่อรายการ / ผู้ขอ"
                    className="h-8 w-full min-w-[120px] rounded-md border border-slate-200 px-2 text-xs font-normal placeholder:text-slate-300 focus:border-blue-400 focus:outline-none"
                  />
                )}
              />
              <SortTh
                label="แผนก"
                col="department"
                active={sortKey} dir={sortDir} onSort={handleSort}
                search={showColumnSearch && (
                  <input
                    value={colFilters.department}
                    onChange={(e) => setColFilter("department", e.target.value)}
                    placeholder="แผนก"
                    className="h-8 w-full min-w-[80px] rounded-md border border-slate-200 px-2 text-xs font-normal placeholder:text-slate-300 focus:border-blue-400 focus:outline-none"
                  />
                )}
              />
              <th className="px-4 py-3 align-top text-center font-medium text-slate-500">สถานะ</th>
              <SortTh label="วันที่" col="created_at" active={sortKey} dir={sortDir} onSort={handleSort} />
              <SortTh
                label="มูลค่า"
                col="total_amount"
                active={sortKey} dir={sortDir} onSort={handleSort}
                className="text-right"
                search={showColumnSearch && (
                  <div className="flex items-center gap-1">
                    <input
                      value={colFilters.amountMin}
                      onChange={(e) => setColFilter("amountMin", e.target.value.replace(/[^\d.]/g, ""))}
                      placeholder="ต่ำสุด"
                      inputMode="decimal"
                      className="h-8 w-16 rounded-md border border-slate-200 px-2 text-right text-xs font-normal placeholder:text-slate-300 focus:border-blue-400 focus:outline-none"
                    />
                    <span className="text-slate-300">–</span>
                    <input
                      value={colFilters.amountMax}
                      onChange={(e) => setColFilter("amountMax", e.target.value.replace(/[^\d.]/g, ""))}
                      placeholder="สูงสุด"
                      inputMode="decimal"
                      className="h-8 w-16 rounded-md border border-slate-200 px-2 text-right text-xs font-normal placeholder:text-slate-300 focus:border-blue-400 focus:outline-none"
                    />
                  </div>
                )}
              />
              <th className="px-4 py-3 w-24 align-top">
                {showColumnSearch && activeFilterCount > 0 && (
                  <button
                    onClick={() => setColFilters(EMPTY_COL_FILTERS)}
                    title="ล้างเงื่อนไขค้นหา"
                    className="mt-6 rounded-md p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
                  >
                    <X size={14} />
                  </button>
                )}
              </th>
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-10 text-center text-sm text-slate-400">
                  ไม่พบรายการตามเงื่อนไขที่ค้นหา
                </td>
              </tr>
            )}
            {sorted.map((pr) => {
              const isChecked = selected.has(pr.id);
              return (
                <tr
                  key={pr.id}
                  onClick={() => toggleOne(pr.id)}
                  className={`cursor-pointer border-b border-slate-100 transition select-none last:border-0 ${
                    isChecked ? "bg-green-50" : "hover:bg-slate-50"
                  }`}
                >
                  <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                    <button onClick={() => toggleOne(pr.id)} className="flex items-center">
                      {isChecked
                        ? <CheckSquare size={16} className="text-green-600" />
                        : <Square size={16} className="text-slate-400" />}
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <span className="font-mono text-xs font-bold text-amber-700">
                      {pr.pr_number}
                    </span>
                  </td>
                  <td className="px-4 py-3 max-w-[220px]">
                    <p className="truncate font-medium text-slate-800">{pr.title}</p>
                    <p className="text-xs text-slate-400">{pr.requester_name}</p>
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-500 whitespace-nowrap">
                    {pr.department ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <StatusBadge kind="pr" status={pr.status} />
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className="text-xs text-slate-400">{formatDate(pr.created_at)}</span>
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-slate-800">
                    {formatCurrency(pr.total_amount)}
                  </td>
                  <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                    <Link
                      href={`/requisitions/${pr.id}`}
                      className="inline-block rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-medium text-white whitespace-nowrap hover:bg-amber-700"
                    >
                      พิจารณา →
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        </div>
      </div>
    </div>
  );
}
