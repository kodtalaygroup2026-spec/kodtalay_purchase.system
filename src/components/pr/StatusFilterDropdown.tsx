"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { PR_STATUS_LABELS } from "@/lib/constants";
import type { PrStatus } from "@/types/database";

/** จุดสีประจำสถานะ — ให้โทนเดียวกับ StatusBadge */
const STATUS_DOT: Record<PrStatus, string> = {
  draft:                   "bg-slate-400",
  submitted:               "bg-amber-400",
  pending_second_approval: "bg-orange-400",
  approved:                "bg-green-500",
  converted:               "bg-green-600",
  returned:                "bg-orange-400",
  rejected:                "bg-red-500",
  cancelled:               "bg-red-400",
  pending_finance:         "bg-violet-500",
  paid:                    "bg-teal-500",
};

interface StatusFilterDropdownProps {
  value: PrStatus | "";
  onChange: (status: PrStatus | "") => void;
  /** สถานะที่เลือกได้ (ขึ้นกับขั้นตอนที่กำลังดู) */
  options: PrStatus[];
  /** จำนวนใบของแต่ละสถานะ */
  counts: Record<string, number>;
  totalCount: number;
}

export function StatusFilterDropdown({
  value,
  onChange,
  options,
  counts,
  totalCount,
}: StatusFilterDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setIsOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isOpen]);

  function select(status: PrStatus | "") {
    onChange(status);
    setIsOpen(false);
  }

  const isAll = value === "";

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className={`flex h-[38px] w-full min-w-[190px] items-center gap-2 rounded-lg border px-3 text-sm transition ${
          isAll
            ? "border-slate-300 bg-white text-slate-600 hover:border-slate-400"
            : "border-blue-400 bg-blue-50/60 font-medium text-blue-800"
        }`}
      >
        {!isAll && <span className={`h-2 w-2 shrink-0 rounded-full ${STATUS_DOT[value]}`} />}
        <span className="flex-1 truncate text-left">
          {isAll ? "สถานะทั้งหมด" : PR_STATUS_LABELS[value]}
        </span>
        <ChevronDown
          size={15}
          className={`shrink-0 transition ${isOpen ? "rotate-180" : ""} ${isAll ? "text-slate-400" : "text-blue-400"}`}
        />
      </button>

      {isOpen && (
        <div className="absolute left-0 z-30 mt-2 max-h-[320px] w-[248px] overflow-y-auto rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl">
          <StatusOption
            label="สถานะทั้งหมด"
            count={totalCount}
            isActive={isAll}
            onClick={() => select("")}
          />

          <div className="my-1 border-t border-slate-100" />

          {options.map((status) => (
            <StatusOption
              key={status}
              label={PR_STATUS_LABELS[status]}
              dotClass={STATUS_DOT[status]}
              count={counts[status] ?? 0}
              isActive={value === status}
              onClick={() => select(status)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ── ตัวเลือกหนึ่งบรรทัดในแผง ────────────────────────────────────────────────
function StatusOption({
  label,
  dotClass,
  count,
  isActive,
  onClick,
}: {
  label: string;
  dotClass?: string;
  count: number;
  isActive: boolean;
  onClick: () => void;
}) {
  const isEmpty = count === 0;

  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-sm transition ${
        isActive ? "bg-blue-50 font-semibold text-blue-700" : "text-slate-600 hover:bg-slate-50"
      }`}
    >
      {dotClass ? (
        <span className={`h-2 w-2 shrink-0 rounded-full ${dotClass} ${isEmpty ? "opacity-40" : ""}`} />
      ) : (
        <span className="h-2 w-2 shrink-0" />
      )}
      <span className={`flex-1 truncate text-left ${isEmpty && !isActive ? "text-slate-400" : ""}`}>
        {label}
      </span>
      <span
        className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
          isActive ? "bg-blue-100 text-blue-700" : "bg-slate-100 text-slate-500"
        }`}
      >
        {count}
      </span>
      {isActive && <Check size={13} className="shrink-0 text-blue-600" />}
    </button>
  );
}
