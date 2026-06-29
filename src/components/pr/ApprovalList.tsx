"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import { CheckCircle, CheckSquare, Square, ChevronUp, ChevronDown, ChevronsUpDown } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/utils/format";
import { StatusBadge } from "@/components/ui/StatusBadge";
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
        className="flex items-center gap-1 font-medium text-slate-500 hover:text-slate-700 group"
      >
        {label}
        <span className={`transition ${isActive ? "text-blue-500" : "text-slate-300 group-hover:text-slate-400"}`}>
          {isActive
            ? dir === "asc" ? <ChevronUp size={13} /> : <ChevronDown size={13} />
            : <ChevronsUpDown size={13} />}
        </span>
      </button>
    </th>
  );
}

// ── Main component ───────────────────────────────────────────────────────────

export function ApprovalList({ prs, currentUserId }: ApprovalListProps) {
  const router = useRouter();
  const supabase = createClient();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>("created_at");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  function handleSort(col: SortKey) {
    if (col === sortKey) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(col); setSortDir("asc"); }
  }

  const sorted = sortPRs(prs, sortKey, sortDir);
  const allSelected = prs.length > 0 && selected.size === prs.length;

  function toggleAll() {
    if (allSelected) setSelected(new Set());
    else setSelected(new Set(prs.map((pr) => pr.id)));
  }

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
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
          void fetch("/api/notifications/line", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              lineUserId: pr.requester_line_id,
              message:
                `✅ ใบขอซื้อของคุณได้รับการอนุมัติ\n\n` +
                `เลขที่: ${pr.pr_number}\n` +
                `หัวข้อ: ${pr.title}\n` +
                `มูลค่ารวม: ${formatCurrency(pr.total_amount)}\n\n` +
                `👉 ดูรายละเอียด:\n${origin}/requisitions/${pr.id}`,
            }),
          });
        }
      }
      setSelected(new Set());
      router.refresh();
    }

    setIsLoading(false);
  }

  return (
    <div className="space-y-3">
      {/* ── Bulk action bar ─────────────────────────────────────────────────── */}
      {selected.size > 0 && (
        <div className="flex items-center justify-between rounded-xl border border-green-200 bg-green-50 px-4 py-3 shadow-sm">
          <span className="text-sm font-medium text-green-700">
            เลือก {selected.size} รายการ
          </span>
          <button
            onClick={handleBulkApprove}
            disabled={isLoading}
            className="flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-green-700 disabled:opacity-60"
          >
            <CheckCircle size={15} />
            {isLoading ? "กำลังอนุมัติ..." : `อนุมัติ ${selected.size} รายการ`}
          </button>
        </div>
      )}

      {/* ── Table ───────────────────────────────────────────────────────────── */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
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
              <SortTh label="เลขที่ PR"   col="pr_number"     active={sortKey} dir={sortDir} onSort={handleSort} />
              <SortTh label="ชื่อ / ผู้ขอ" col="title"        active={sortKey} dir={sortDir} onSort={handleSort} />
              <SortTh label="แผนก"         col="department"    active={sortKey} dir={sortDir} onSort={handleSort} className="hidden md:table-cell" />
              <th className="px-4 py-3 text-center font-medium text-slate-500">สถานะ</th>
              <SortTh label="วันที่"        col="created_at"   active={sortKey} dir={sortDir} onSort={handleSort} className="hidden sm:table-cell" />
              <SortTh label="มูลค่า"        col="total_amount" active={sortKey} dir={sortDir} onSort={handleSort} className="text-right" />
              <th className="px-4 py-3 w-24" />
            </tr>
          </thead>
          <tbody>
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
                  <td className="px-4 py-3 hidden md:table-cell text-sm text-slate-500">
                    {pr.department ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <StatusBadge kind="pr" status={pr.status} />
                  </td>
                  <td className="px-4 py-3 hidden sm:table-cell">
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
  );
}
