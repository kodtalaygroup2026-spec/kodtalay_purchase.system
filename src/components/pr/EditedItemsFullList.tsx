"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, ChevronUp, ExternalLink } from "lucide-react";
import { formatDateTime, formatCurrency } from "@/lib/utils/format";
import type { EditedPRRow } from "./EditedItemsPanel";

interface ItemChange {
  item_id: string;
  description: string;
  quantity_old: number;
  quantity_new: number;
  unit_price_old: number;
  unit_price_new: number;
}

function EditedPRCard({ pr }: { pr: EditedPRRow }) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="overflow-hidden rounded-xl border border-amber-200 bg-white shadow-sm">
      {/* Header row */}
      <div
        className="flex cursor-pointer items-center justify-between gap-2 px-5 py-4 transition-colors hover:bg-amber-50"
        onClick={() => setIsOpen((o) => !o)}
      >
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs font-bold text-blue-700">
              {pr.pr_number}
            </span>
            <span className="truncate text-sm font-semibold text-slate-800">
              {pr.title}
            </span>
          </div>
          <p className="mt-0.5 text-xs text-slate-400">
            โดย {pr.requester_name} · แก้ไขแล้ว {pr.logs.length} ครั้ง ·
            ยอดปัจจุบัน {formatCurrency(pr.total_amount)}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              router.push(`/requisitions/${pr.pr_id}`);
            }}
            className="flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-600 hover:bg-slate-50"
          >
            ดู <ExternalLink size={10} />
          </button>
          {isOpen ? (
            <ChevronUp size={14} className="text-slate-400" />
          ) : (
            <ChevronDown size={14} className="text-slate-400" />
          )}
        </div>
      </div>

      {/* Expanded edit logs */}
      {isOpen && (
        <div className="space-y-3 border-t border-amber-100 px-5 py-4">
          {pr.logs.map((log) => (
            <div
              key={log.id}
              className="rounded-lg border border-amber-100 bg-amber-50 px-3 py-2.5"
            >
              <p className="mb-2 text-[11px] font-semibold text-amber-700">
                แก้ไขโดย {log.editor_name} · {formatDateTime(log.edited_at)}
              </p>
              <ul className="space-y-1.5">
                {(log.changes as ItemChange[]).map((ch, i) => (
                  <li key={i} className="text-xs text-slate-600">
                    <span className="font-medium">{ch.description}</span>
                    {ch.quantity_old !== ch.quantity_new && (
                      <span className="ml-2 text-slate-500">
                        จำนวน: {ch.quantity_old} →{" "}
                        <span className="font-semibold text-slate-700">
                          {ch.quantity_new}
                        </span>
                      </span>
                    )}
                    {ch.unit_price_old !== ch.unit_price_new && (
                      <span className="ml-2 text-slate-500">
                        ราคา: ฿{ch.unit_price_old} →{" "}
                        <span className="font-semibold text-slate-700">
                          ฿{ch.unit_price_new}
                        </span>
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function EditedItemsFullList({ prs }: { prs: EditedPRRow[] }) {
  if (prs.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 bg-white py-16 text-center">
        <p className="text-slate-500">ไม่มีรายการที่มีการแก้ไข</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {prs.map((pr) => (
        <EditedPRCard key={pr.pr_id} pr={pr} />
      ))}
    </div>
  );
}
