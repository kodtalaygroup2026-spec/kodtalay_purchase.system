"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight, X } from "lucide-react";
import { formatDate } from "@/lib/utils/format";
import {
  EMPTY_DATE_RANGE,
  isRangeEmpty,
  presetRange,
  toISODate,
  type DateRange,
} from "@/lib/utils/dateRange";

const PRESETS: { key: Parameters<typeof presetRange>[0]; label: string }[] = [
  { key: "today",     label: "วันนี้" },
  { key: "last7",     label: "7 วันล่าสุด" },
  { key: "last30",    label: "30 วันล่าสุด" },
  { key: "thisMonth", label: "เดือนนี้" },
  { key: "lastMonth", label: "เดือนที่แล้ว" },
];

const WEEKDAYS = ["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"];

const PANEL_WIDTH = 320;
const VIEWPORT_MARGIN = 8;

interface DateRangePickerProps {
  value: DateRange;
  onChange: (range: DateRange) => void;
  /** ข้อความเมื่อยังไม่ได้เลือกช่วง */
  placeholder?: string;
}

interface PanelPosition {
  top: number;
  left: number;
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

/** วันทั้งหมดในเดือนที่แสดง เติม null นำหน้าให้ตรงคอลัมน์วันในสัปดาห์ */
function buildCalendarDays(viewMonth: Date): (string | null)[] {
  const year = viewMonth.getFullYear();
  const month = viewMonth.getMonth();
  const firstWeekday = new Date(year, month, 1).getDay(); // 0 = อาทิตย์
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const cells: (string | null)[] = Array(firstWeekday).fill(null);
  for (let day = 1; day <= daysInMonth; day++) {
    cells.push(toISODate(new Date(year, month, day)));
  }
  return cells;
}

export function DateRangePicker({
  value,
  onChange,
  placeholder = "ทุกช่วงเวลา",
}: DateRangePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [position, setPosition] = useState<PanelPosition | null>(null);
  const [viewMonth, setViewMonth] = useState<Date>(
    () => new Date(new Date().getFullYear(), new Date().getMonth(), 1)
  );
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const hasRange = !isRangeEmpty(value);
  const todayIso = toISODate(new Date());

  // เปิดแผงเมื่อไร ให้ปฏิทินกระโดดไปเดือนของวันที่เลือกไว้ (หรือเดือนปัจจุบัน)
  useEffect(() => {
    if (!isOpen) return;
    const base = value.from ? new Date(`${value.from}T00:00:00`) : new Date();
    setViewMonth(new Date(base.getFullYear(), base.getMonth(), 1));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  // วางแผงแบบ fixed อ้างอิงจากตำแหน่งปุ่ม เพื่อหลุดจากกล่องตารางที่มี overflow-hidden
  useLayoutEffect(() => {
    if (!isOpen) return;

    function reposition() {
      const trigger = triggerRef.current;
      if (!trigger) return;
      const rect = trigger.getBoundingClientRect();
      const panelHeight = panelRef.current?.offsetHeight ?? 430;

      const maxLeft = window.innerWidth - PANEL_WIDTH - VIEWPORT_MARGIN;
      const left = Math.max(VIEWPORT_MARGIN, Math.min(rect.right - PANEL_WIDTH, maxLeft));

      const spaceBelow = window.innerHeight - rect.bottom;
      const openUp = spaceBelow < panelHeight + VIEWPORT_MARGIN && rect.top > spaceBelow;
      const top = openUp
        ? Math.max(VIEWPORT_MARGIN, rect.top - panelHeight - VIEWPORT_MARGIN)
        : rect.bottom + VIEWPORT_MARGIN;

      setPosition({ top, left });
    }

    reposition();
    window.addEventListener("scroll", reposition, true);
    window.addEventListener("resize", reposition);
    return () => {
      window.removeEventListener("scroll", reposition, true);
      window.removeEventListener("resize", reposition);
    };
  }, [isOpen, viewMonth]);

  // ปิดแผงเมื่อคลิกนอกกรอบ หรือกด Escape
  useEffect(() => {
    if (!isOpen) return;
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node;
      if (triggerRef.current?.contains(target)) return;
      if (panelRef.current?.contains(target)) return;
      setIsOpen(false);
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

  function applyPreset(key: Parameters<typeof presetRange>[0]) {
    onChange(presetRange(key));
  }

  function clearRange() {
    onChange(EMPTY_DATE_RANGE);
  }

  /** จิ้มครั้งแรก = วันเริ่ม · จิ้มครั้งที่สอง = วันจบ (สลับให้เองถ้าเลือกย้อนหลัง) */
  function handleDayClick(dayIso: string) {
    const selectingEnd = value.from && !value.to;
    if (!selectingEnd) {
      onChange({ from: dayIso, to: null });
      return;
    }
    if (dayIso < value.from!) onChange({ from: dayIso, to: value.from });
    else onChange({ from: value.from, to: dayIso });
  }

  const activePresetKey = PRESETS.find((p) => {
    const r = presetRange(p.key);
    return r.from === value.from && r.to === value.to;
  })?.key;

  const monthLabel = useMemo(
    () => new Intl.DateTimeFormat("th-TH", { month: "long", year: "numeric" }).format(viewMonth),
    [viewMonth]
  );
  const calendarDays = useMemo(() => buildCalendarDays(viewMonth), [viewMonth]);

  const selectionHint = !value.from
    ? "แตะวันที่ในปฏิทินเพื่อเลือกวันเริ่มต้น"
    : !value.to
      ? `เริ่ม ${formatDate(value.from)} — แตะอีกครั้งเพื่อเลือกวันสิ้นสุด`
      : `${formatDate(value.from)} – ${formatDate(value.to)}`;

  const panel = isOpen ? (
    <div
      ref={panelRef}
      style={{
        position: "fixed",
        top: position?.top ?? -9999,
        left: position?.left ?? -9999,
        width: PANEL_WIDTH,
        visibility: position ? "visible" : "hidden",
      }}
      className="z-50 rounded-xl border border-slate-200 bg-white p-3 shadow-xl"
    >
      {/* ── ช่วงที่ใช้บ่อย ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-1.5">
        {PRESETS.map((preset) => {
          const isActive = activePresetKey === preset.key;
          return (
            <button
              key={preset.key}
              type="button"
              onClick={() => applyPreset(preset.key)}
              className={`rounded-lg border px-1.5 py-1.5 text-xs font-medium transition ${
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
          className={`rounded-lg border px-1.5 py-1.5 text-xs font-medium transition ${
            !hasRange
              ? "border-slate-700 bg-slate-700 text-white"
              : "border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50"
          }`}
        >
          ทุกช่วงเวลา
        </button>
      </div>

      <div className="my-3 border-t border-slate-100" />

      {/* ── ปฏิทินเลือกช่วงเอง ─────────────────────────────────────────── */}
      <div className="mb-2 flex items-center justify-between">
        <button
          type="button"
          onClick={() => setViewMonth((m) => new Date(m.getFullYear(), m.getMonth() - 1, 1))}
          aria-label="เดือนก่อนหน้า"
          className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100"
        >
          <ChevronLeft size={16} />
        </button>
        <p className="text-sm font-semibold text-slate-700">{monthLabel}</p>
        <button
          type="button"
          onClick={() => setViewMonth((m) => new Date(m.getFullYear(), m.getMonth() + 1, 1))}
          aria-label="เดือนถัดไป"
          className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100"
        >
          <ChevronRight size={16} />
        </button>
      </div>

      <div className="grid grid-cols-7">
        {WEEKDAYS.map((day) => (
          <span key={day} className="py-1 text-center text-[10px] font-semibold text-slate-400">
            {day}
          </span>
        ))}
        {calendarDays.map((iso, index) => {
          if (!iso) return <span key={`blank-${index}`} />;

          const isStart = iso === value.from;
          const isEnd = iso === value.to;
          const isInRange = Boolean(value.from && value.to && iso > value.from && iso < value.to);
          const isToday = iso === todayIso;
          const dayNumber = Number(iso.slice(8));

          return (
            <button
              key={iso}
              type="button"
              onClick={() => handleDayClick(iso)}
              className={`mx-auto flex h-9 w-9 items-center justify-center text-sm transition ${
                isStart || isEnd
                  ? "rounded-full bg-blue-600 font-bold text-white shadow-sm"
                  : isInRange
                    ? "rounded-none bg-blue-50 text-blue-800"
                    : `rounded-full text-slate-700 hover:bg-slate-100 ${
                        isToday ? "font-bold text-blue-600 ring-1 ring-inset ring-blue-300" : ""
                      }`
              }`}
            >
              {dayNumber}
            </button>
          );
        })}
      </div>

      {/* คำแนะนำสถานะการเลือก */}
      <p className="mt-2 rounded-lg bg-slate-50 px-3 py-1.5 text-center text-[11px] text-slate-500">
        {selectionHint}
      </p>

      <div className="mt-2.5 flex items-center justify-between border-t border-slate-100 pt-2.5">
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
  ) : null;

  return (
    <div className="relative">
      {/* ── ช่องแสดงวันที่ ────────────────────────────────────────────────── */}
      <button
        ref={triggerRef}
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

      {/* แผงเรนเดอร์ผ่าน portal ไป body — ไม่ถูกกล่องตารางที่ overflow-hidden ตัดขอบ */}
      {typeof document !== "undefined" && panel ? createPortal(panel, document.body) : null}
    </div>
  );
}
