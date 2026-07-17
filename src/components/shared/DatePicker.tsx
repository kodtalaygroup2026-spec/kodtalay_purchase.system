"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { CalendarDays, ChevronLeft, ChevronRight, X } from "lucide-react";
import { formatDate } from "@/lib/utils/format";
import { toISODate } from "@/lib/utils/dateRange";

const WEEKDAYS = ["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"];
const PANEL_WIDTH = 280;
const VIEWPORT_MARGIN = 8;

interface DatePickerProps {
  /** วันที่ที่เลือก รูปแบบ "YYYY-MM-DD" — ค่าว่าง = ยังไม่เลือก */
  value: string;
  onChange: (iso: string) => void;
  placeholder?: string;
  /** sm = ช่องเตี้ยสำหรับหัวตาราง / md = ช่องปกติในแถบเครื่องมือ */
  size?: "sm" | "md";
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

/**
 * ตัวเลือกวันที่เดี่ยว หน้าตาเดียวกับปฏิทินของ DateRangePicker —
 * ใช้แทน <input type="date"> ที่ป๊อปอัปของเบราว์เซอร์แต่งสไตล์ไม่ได้
 * แผงเรนเดอร์ผ่าน portal จึงไม่โดนกล่อง overflow-hidden ตัดขอบ
 */
export function DatePicker({
  value,
  onChange,
  placeholder = "เลือกวันที่",
  size = "md",
}: DatePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);
  const [viewMonth, setViewMonth] = useState<Date>(
    () => new Date(new Date().getFullYear(), new Date().getMonth(), 1)
  );
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const todayIso = toISODate(new Date());

  // เปิดแผงเมื่อไร ให้ปฏิทินกระโดดไปเดือนของวันที่เลือกไว้ (หรือเดือนปัจจุบัน)
  useEffect(() => {
    if (!isOpen) return;
    const base = value ? new Date(`${value}T00:00:00`) : new Date();
    setViewMonth(new Date(base.getFullYear(), base.getMonth(), 1));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  // วางแผงแบบ fixed อ้างอิงจากปุ่ม — หลุดจากทุกกล่องที่ overflow-hidden
  useLayoutEffect(() => {
    if (!isOpen) return;

    function reposition() {
      const trigger = triggerRef.current;
      if (!trigger) return;
      const rect = trigger.getBoundingClientRect();
      const panelHeight = panelRef.current?.offsetHeight ?? 330;

      const maxLeft = window.innerWidth - PANEL_WIDTH - VIEWPORT_MARGIN;
      const left = Math.max(VIEWPORT_MARGIN, Math.min(rect.left, maxLeft));

      const spaceBelow = window.innerHeight - rect.bottom;
      const openUp = spaceBelow < panelHeight + VIEWPORT_MARGIN && rect.top > spaceBelow;
      const top = openUp
        ? Math.max(VIEWPORT_MARGIN, rect.top - panelHeight - 6)
        : rect.bottom + 6;

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

  // ปิดเมื่อคลิกนอกกรอบ หรือกด Escape
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

  function selectDay(iso: string) {
    onChange(iso);
    setIsOpen(false);
  }

  const monthLabel = useMemo(
    () => new Intl.DateTimeFormat("th-TH", { month: "long", year: "numeric" }).format(viewMonth),
    [viewMonth]
  );
  const calendarDays = useMemo(() => buildCalendarDays(viewMonth), [viewMonth]);

  const triggerSize =
    size === "sm"
      ? "h-8 rounded-md px-2 text-xs"
      : "h-[38px] rounded-lg px-3 text-sm";

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
      {/* เดือน + ปุ่มเลื่อน */}
      <div className="mb-1.5 flex items-center justify-between">
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

      {/* ตารางวัน */}
      <div className="grid grid-cols-7">
        {WEEKDAYS.map((day) => (
          <span key={day} className="py-1 text-center text-[10px] font-semibold text-slate-400">
            {day}
          </span>
        ))}
        {calendarDays.map((iso, index) => {
          if (!iso) return <span key={`blank-${index}`} />;

          const isSelected = iso === value;
          const isToday = iso === todayIso;

          return (
            <button
              key={iso}
              type="button"
              onClick={() => selectDay(iso)}
              className={`mx-auto flex h-8 w-8 items-center justify-center rounded-full text-sm transition ${
                isSelected
                  ? "bg-blue-600 font-bold text-white shadow-sm"
                  : `text-slate-700 hover:bg-slate-100 ${
                      isToday ? "font-bold text-blue-600 ring-1 ring-inset ring-blue-300" : ""
                    }`
              }`}
            >
              {Number(iso.slice(8))}
            </button>
          );
        })}
      </div>

      <div className="mt-2 flex items-center justify-between border-t border-slate-100 pt-2">
        <button
          type="button"
          onClick={() => { onChange(""); setIsOpen(false); }}
          className="rounded-lg px-2 py-1 text-xs text-slate-400 hover:bg-slate-50 hover:text-slate-600"
        >
          ล้าง
        </button>
        <button
          type="button"
          onClick={() => selectDay(todayIso)}
          className="rounded-lg px-2 py-1 text-xs font-semibold text-blue-600 hover:bg-blue-50"
        >
          วันนี้
        </button>
      </div>
    </div>
  ) : null;

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className={`flex w-full min-w-[112px] items-center gap-1.5 border font-normal transition ${triggerSize} ${
          value
            ? "border-blue-400 bg-blue-50/60 text-blue-800"
            : "border-slate-200 bg-white text-slate-300 hover:border-slate-300"
        }`}
      >
        <CalendarDays size={13} className={value ? "text-blue-500" : "text-slate-300"} />
        <span className={`flex-1 truncate text-left ${value ? "font-medium" : ""}`}>
          {value ? formatDate(value) : placeholder}
        </span>
        {value && (
          <span
            role="button"
            tabIndex={0}
            aria-label="ล้างวันที่"
            onClick={(e) => { e.stopPropagation(); onChange(""); }}
            onKeyDown={(e) => { if (e.key === "Enter") { e.stopPropagation(); onChange(""); } }}
            className="rounded p-0.5 text-blue-400 hover:bg-blue-100 hover:text-blue-700"
          >
            <X size={12} />
          </span>
        )}
      </button>

      {typeof document !== "undefined" && panel ? createPortal(panel, document.body) : null}
    </>
  );
}
