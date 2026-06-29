"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import { CheckCircle, CheckSquare, Square } from "lucide-react";
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

interface ApprovalListProps {
  prs: PRApprovalRow[];
  currentUserId: string;
}

export function ApprovalList({ prs, currentUserId }: ApprovalListProps) {
  const router = useRouter();
  const supabase = createClient();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(false);

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
      // แจ้ง LINE requester แต่ละคน (non-blocking)
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
    <div className="space-y-4">
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

      {/* ── Select all ──────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 px-1">
        <button
          onClick={toggleAll}
          className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-700"
        >
          {allSelected
            ? <CheckSquare size={16} className="text-blue-600" />
            : <Square size={16} />}
          {allSelected ? "ยกเลิกเลือกทั้งหมด" : "เลือกทั้งหมด"}
        </button>
      </div>

      {/* ── PR rows ─────────────────────────────────────────────────────────── */}
      <div className="space-y-3">
        {prs.map((pr) => {
          const isChecked = selected.has(pr.id);
          return (
            <div
              key={pr.id}
              onClick={() => toggleOne(pr.id)}
              className={`flex cursor-pointer items-center gap-3 rounded-xl border px-5 py-4 transition select-none ${
                isChecked
                  ? "border-green-300 bg-green-50"
                  : "border-amber-200 bg-amber-50 hover:border-amber-300"
              }`}
            >
              {/* Checkbox icon */}
              <div className="shrink-0">
                {isChecked
                  ? <CheckSquare size={18} className="text-green-600" />
                  : <Square size={18} className="text-slate-400" />}
              </div>

              {/* Info */}
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-bold text-amber-700">
                    {pr.pr_number}
                  </span>
                  <StatusBadge kind="pr" status={pr.status} />
                </div>
                <p className="truncate font-semibold text-slate-800">{pr.title}</p>
                <p className="text-sm text-slate-500">
                  โดย {pr.requester_name}
                  {pr.department && ` · ${pr.department}`}
                  {" · "}
                  {formatDate(pr.created_at)}
                </p>
              </div>

              {/* Amount + link (หยุด event ไม่ให้ toggle checkbox) */}
              <div
                className="shrink-0 text-right"
                onClick={(e) => e.stopPropagation()}
              >
                <p className="font-bold text-slate-800">
                  {formatCurrency(pr.total_amount)}
                </p>
                <Link
                  href={`/requisitions/${pr.id}`}
                  className="mt-1 inline-block rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-700"
                >
                  พิจารณา →
                </Link>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
