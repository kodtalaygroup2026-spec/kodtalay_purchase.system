"use client";

import { useEffect, useRef, useState } from "react";
import { CalendarDays, ChevronDown, X } from "lucide-react";
import { formatDate } from "@/lib/utils/format";
import {
  EMPTY_DATE_RANGE,
  isRangeEmpty,
  presetRange,
  type DateRange,
} from "@/lib/utils/dateRange";

const PRESETS: { key: Parameters<typeof presetRange>[0]; label: string }[] = [
  { key: "today",     label: "วันนี้" },
  { key: "last7",     label: "7 วันล่าสุด" },
  { key: "last30",    label: "30 วันล่าสุด" },
  { key: "thisMonth", label: "เดือนนี้" },
  { key: "lastMonth", label: "เดือนที่แล้ว" },
];

interface DateRangePickerProps {
  value: DateRange;
  onChange: (range: DateRange) => void;
  /** ข้อความเมื่อยังไม่ได้เลือกช่วง */
  placeholder?: string;
}

/** สรุปช่วงวันที่ให้อ่านง่ายบนหน้าปุ่ม */
function summarize(range: DateRange, placeholder: string): string {
  if (isRangeEmpty(range)) return placeholder;
  if (range.from && range.to) {
    return range.from === range.to
      ? formatDate(range.from)
      : `${formatDate(range.from)} – ${formatDate(range.to)}`;
  }
  if (range.from) return `ตั้งแต่ ${formatDate(range.from)}`;
  return `ถึง ${formatDate(range.to)}`;
}

export function DateRangePicker({
  value,
  onChange,
  placeholder = "ทุกช่วงเวลา",
}: DateRangePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const hasRange = !isRangeEmpty(value);

  // ปิดแผงเมื่อคลิกนอกกรอบ
  useEffect(() => {
    if (!isOpen) return;
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  function applyPreset(key: Parameters<typeof presetRange>[0]) {
    onChange(presetRange(key));
  }

  function clearRange() {
    onChange(EMPTY_DATE_RANGE);
  }

  const activePresetKey = PRESETS.find((p) => {
    const r = presetRange(p.key);
    return r.from === value.from && r.to === value.to;
  })?.key;

  return (
    <div ref={containerRef} className="relative">
      {/* ── ช่องแสดงวันที่ ────────────────────────────────────────────────── */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className={`flex h-[38px] w-full min-w-[240px] items-center gap-2 rounded-lg border px-3 text-sm transition ${
          hasRange
            ? "border-blue-400 bg-blue-50/60 text-blue-800"
            : "border-slate-300 bg-white text-slate-500 hover:border-slate-400"
        }`}
      >
        <CalendarDays size={15} className={hasRange ? "text-blue-500" : "text-slate-400"} />
        <span className={`flex-1 truncate text-left ${hasRange ? "font-medium" : ""}`}>
          {summarize(value, placeholder)}
        </span>
        {hasRange ? (
          <span
            role="button"
            tabIndex={0}
            aria-label="ล้างช่วงวันที่"
            onClick={(e) => { e.stopPropagation(); clearRange(); }}
            onKeyDown={(e) => { if (e.key === "Enter") { e.stopPropagation(); clearRange(); } }}
            className="rounded p-0.5 text-blue-400 hover:bg-blue-100 hover:text-blue-700"
          >
            <X size={14} />
          </span>
        ) : (
          <ChevronDown size={15} className={`text-slate-400 transition ${isOpen ? "rotate-180" : ""}`} />
        )}
      </button>

      {/* ── แผงเลือกช่วงวันที่ ────────────────────────────────────────────── */}
      {isOpen && (
        <div className="absolute right-0 z-30 mt-2 w-[320px] rounded-xl border border-slate-200 bg-white p-3 shadow-xl">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-slate-400">
            ช่วงที่ใช้บ่อย
          </p>
          <div className="grid grid-cols-2 gap-1.5">
            {PRESETS.map((preset) => {
              const isActive = activePresetKey === preset.key;
              return (
                <button
                  key={preset.key}
                  type="button"
                  onClick={() => applyPreset(preset.key)}
                  className={`rounded-lg border px-2.5 py-1.5 text-xs font-medium transition ${
                    isActive
                      ? "border-blue-500 bg-blue-500 text-white"
                      : "border-slate-200 text-slate-600 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700"
                  }`}
                >
                  {preset.label}
                </button>
              );
            })}
            <button
              type="button"
              onClick={clearRange}
              className={`rounded-lg border px-2.5 py-1.5 text-xs font-medium transition ${
                !hasRange
                  ? "border-slate-700 bg-slate-700 text-white"
                  : "border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50"
              }`}
            >
              ทุกช่วงเวลา
            </button>
          </div>

          <div className="my-3 border-t border-slate-100" />

          <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-slate-400">
            กำหนดเอง
          </p>
          <div className="grid grid-cols-2 gap-2">
            <label className="block">
              <span className="mb-1 block text-[11px] text-slate-500">ตั้งแต่วันที่</span>
              <input
                type="date"
                value={value.from ?? ""}
                max={value.to ?? undefined}
                onChange={(e) => onChange({ ...value, from: e.target.value || null })}
                className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-xs text-slate-700 focus:border-blue-500 focus:outline-none"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-[11px] text-slate-500">ถึงวันที่</span>
              <input
                type="date"
                value={value.to ?? ""}
                min={value.from ?? undefined}
                onChange={(e) => onChange({ ...value, to: e.target.value || null })}
                className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-xs text-slate-700 focus:border-blue-500 focus:outline-none"
              />
            </label>
          </div>

          <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-2.5">
            <button
              type="button"
              onClick={clearRange}
              className="rounded-lg px-2 py-1 text-xs text-slate-400 hover:bg-slate-50 hover:text-slate-600"
            >
              ล้างช่วงวันที่
            </button>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700"
            >
              เสร็จสิ้น
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
