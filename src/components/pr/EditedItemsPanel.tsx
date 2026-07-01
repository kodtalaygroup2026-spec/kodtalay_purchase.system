"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, ChevronUp, Pencil, ExternalLink } from "lucide-react";
import { formatDateTime, formatCurrency } from "@/lib/utils/format";

interface ItemChange {
  item_id: string;
  description: string;
  quantity_old: number;
  quantity_new: number;
  unit_price_old: number;
  unit_price_new: number;
}

interface EditLog {
  id: string;
  edited_at: string;
  editor_name: string;
  changes: ItemChange[];
}

export interface EditedPRRow {
  pr_id: string;
  pr_number: string;
  title: string;
  requester_name: string;
  total_amount: number;
  logs: EditLog[];
}

interface EditedItemsPanelProps {
  prs: EditedPRRow[];
}

export function EditedItemsPanel({ prs }: EditedItemsPanelProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [expandedPR, setExpandedPR] = useState<string | null>(null);

  if (prs.length === 0) return null;

  return (
    <div className="rounded-xl border border-amber-200 bg-white shadow-sm overflow-hidden">
      {/* Header toggle */}
      <button
        type="button"
        onClick={() => setIsOpen(o => !o)}
        className="flex w-full items-center justify-between px-5 py-4 text-left transition-colors hover:bg-amber-50"
      >
        <div className="flex items-center gap-2">
          <Pencil size={15} className="text-amber-600" />
          <span className="font-semibold text-slate-700">รายการที่มีการแก้ไขหลังส่งหลักฐาน</span>
          <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-amber-500 px-1.5 text-[10px] font-bold text-white">
            {prs.length}
          </span>
        </div>
        {isOpen
          ? <ChevronUp size={15} className="text-slate-400" />
          : <ChevronDown size={15} className="text-slate-400" />
        }
      </button>

      {isOpen && (
        <div className="divide-y divide-slate-100 border-t border-amber-100">
          {prs.map(pr => (
            <div key={pr.pr_id} className="px-5 py-3">
              {/* PR row header */}
              <div
                className="flex cursor-pointer items-center justify-between gap-2"
                onClick={() => setExpandedPR(prev => prev === pr.pr_id ? null : pr.pr_id)}
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold text-blue-700">{pr.pr_number}</span>
                    <span className="truncate text-sm font-medium text-slate-800">{pr.title}</span>
                  </div>
                  <p className="text-xs text-slate-400">
                    โดย {pr.requester_name} · แก้ไขแล้ว {pr.logs.length} ครั้ง
                    · ยอดปัจจุบัน {formatCurrency(pr.total_amount)}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <button
                    onClick={e => { e.stopPropagation(); router.push(`/requisitions/${pr.pr_id}`); }}
                    className="flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-600 hover:bg-slate-50"
                  >
                    ดู <ExternalLink size={10} />
                  </button>
                  {expandedPR === pr.pr_id
                    ? <ChevronUp size={14} className="text-slate-400" />
                    : <ChevronDown size={14} className="text-slate-400" />
                  }
                </div>
              </div>

              {/* Expanded: show edit logs */}
              {expandedPR === pr.pr_id && (
                <div className="mt-3 space-y-3">
                  {pr.logs.map(log => (
                    <div key={log.id} className="rounded-lg border border-amber-100 bg-amber-50 px-3 py-2">
                      <p className="mb-1.5 text-[11px] font-semibold text-amber-700">
                        แก้ไขโดย {log.editor_name} · {formatDateTime(log.edited_at)}
                      </p>
                      <ul className="space-y-1">
                        {log.changes.map((ch, i) => (
                          <li key={i} className="text-xs text-slate-600">
                            <span className="font-medium">{ch.description}</span>
                            {ch.quantity_old !== ch.quantity_new && (
                              <span className="ml-2 text-slate-500">
                                จำนวน: {ch.quantity_old} → <span className="font-semibold text-slate-700">{ch.quantity_new}</span>
                              </span>
                            )}
                            {ch.unit_price_old !== ch.unit_price_new && (
                              <span className="ml-2 text-slate-500">
                                ราคา: ฿{ch.unit_price_old} → <span className="font-semibold text-slate-700">฿{ch.unit_price_new}</span>
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
          ))}
        </div>
      )}
    </div>
  );
}
