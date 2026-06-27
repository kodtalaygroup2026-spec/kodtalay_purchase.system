"use client";
import { useState, useRef, useEffect } from "react";
import { Calendar, Clock, ChevronLeft, ChevronRight, RotateCcw } from "lucide-react";

const THAI_MONTHS = [
  "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
  "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม",
];
const WEEKDAY_LABELS = ["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"];

// 3 = พุทธ (Wednesday), 5 = ศุกร์ (Friday) — วันตัดรอบส่งเงิน
const CUTOFF_DOW = new Set([3, 5]);

interface DateTimePickerProps {
  value: string;
  onChange: (iso: string) => void;
  label?: string;
  required?: boolean;
}

export function DateTimePicker({ value, onChange, label, required }: DateTimePickerProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const parsed = value ? new Date(value) : null;

  const [viewYear, setViewYear] = useState(parsed?.getFullYear() ?? new Date().getFullYear());
  const [viewMonth, setViewMonth] = useState(parsed?.getMonth() ?? new Date().getMonth());
  const [selHour, setSelHour] = useState(parsed?.getHours() ?? 8);
  const [selMinute, setSelMinute] = useState(
    parsed ? Math.round(parsed.getMinutes() / 5) * 5 : 0
  );

  // ซิงค์เมื่อ value เปลี่ยนจากข้างนอก
  useEffect(() => {
    if (parsed) {
      setViewYear(parsed.getFullYear());
      setViewMonth(parsed.getMonth());
      setSelHour(parsed.getHours());
      setSelMinute(Math.round(parsed.getMinutes() / 5) * 5);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  // ปิดเมื่อคลิกนอก
  useEffect(() => {
    function handleOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, []);

  function prevMonth() {
    if (viewMonth === 0) { setViewYear((y) => y - 1); setViewMonth(11); }
    else setViewMonth((m) => m - 1);
  }
  function nextMonth() {
    if (viewMonth === 11) { setViewYear((y) => y + 1); setViewMonth(0); }
    else setViewMonth((m) => m + 1);
  }

  function pickDay(day: number) {
    const dow = new Date(viewYear, viewMonth, day).getDay();
    // วันตัดรอบ (พุทธ/ศุกร์) → ล็อคเวลา 10:00 น. อัตโนมัติ
    const h = CUTOFF_DOW.has(dow) ? 10 : selHour;
    const m = CUTOFF_DOW.has(dow) ? 0 : selMinute;
    if (CUTOFF_DOW.has(dow)) { setSelHour(10); setSelMinute(0); }
    const d = new Date(viewYear, viewMonth, day, h, m, 0, 0);
    onChange(d.toISOString());
  }

  function applyTime(h: number, m: number) {
    setSelHour(h);
    setSelMinute(m);
    if (parsed) {
      const d = new Date(parsed);
      d.setHours(h, m, 0, 0);
      onChange(d.toISOString());
    }
  }

  function resetToNow() {
    const now = new Date();
    setViewYear(now.getFullYear());
    setViewMonth(now.getMonth());
    setSelHour(now.getHours());
    setSelMinute(Math.round(now.getMinutes() / 5) * 5 % 60);
    onChange(now.toISOString());
  }

  // สร้าง grid วัน
  const firstDow = new Date(viewYear, viewMonth, 1).getDay(); // 0=อา
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const todayObj = new Date();
  const todayYear = todayObj.getFullYear();
  const todayMonth = todayObj.getMonth();
  const todayDate = todayObj.getDate();

  // ข้อความแสดงผล
  const displayText = parsed
    ? new Intl.DateTimeFormat("th-TH", {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }).format(parsed)
    : null;

  return (
    <div className="relative" ref={ref}>
      {label && (
        <label className="mb-1 block text-sm font-medium text-slate-700">
          {label} {required && <span className="text-red-500">*</span>}
        </label>
      )}

      {/* Trigger button */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-left text-sm transition focus:border-blue-500 focus:outline-none hover:border-slate-400"
      >
        <Calendar size={15} className="shrink-0 text-slate-400" />
        <span className={`flex-1 ${displayText ? "text-slate-800" : "text-slate-400"}`}>
          {displayText ?? "เลือกวันที่และเวลา"}
        </span>
        <span
          role="button"
          title="รีเซ็ตเป็นเวลาปัจจุบัน"
          onClick={(e) => { e.stopPropagation(); resetToNow(); }}
          className="rounded p-0.5 text-slate-300 hover:text-blue-500 transition-colors"
        >
          <RotateCcw size={12} />
        </span>
      </button>

      {/* Popover */}
      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 w-72 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl">

          {/* Month navigation */}
          <div className="flex items-center justify-between border-b border-slate-100 px-3 py-2.5">
            <button
              type="button"
              onClick={prevMonth}
              className="rounded-md p-1 text-slate-500 hover:bg-slate-100"
            >
              <ChevronLeft size={16} />
            </button>
            <span className="text-sm font-semibold text-slate-800">
              {THAI_MONTHS[viewMonth]} {viewYear + 543}
            </span>
            <button
              type="button"
              onClick={nextMonth}
              className="rounded-md p-1 text-slate-500 hover:bg-slate-100"
            >
              <ChevronRight size={16} />
            </button>
          </div>

          {/* Calendar grid */}
          <div className="px-3 pb-2 pt-2">
            {/* Weekday headers */}
            <div className="mb-1 grid grid-cols-7">
              {WEEKDAY_LABELS.map((lbl, dow) => (
                <div
                  key={dow}
                  className={`flex flex-col items-center py-1 text-[11px] font-semibold ${
                    CUTOFF_DOW.has(dow) ? "text-orange-500" : "text-slate-400"
                  }`}
                >
                  {lbl}
                  {/* จุดมาร์กวันตัดรอบ */}
                  {CUTOFF_DOW.has(dow) && (
                    <span className="mt-0.5 h-1 w-1 rounded-full bg-orange-400" />
                  )}
                </div>
              ))}
            </div>

            {/* Day cells */}
            <div className="grid grid-cols-7 gap-y-0.5">
              {/* Empty leading cells */}
              {Array.from({ length: firstDow }).map((_, i) => (
                <div key={`e-${i}`} />
              ))}

              {Array.from({ length: daysInMonth }).map((_, i) => {
                const day = i + 1;
                const dow = (firstDow + i) % 7;
                const isCutoff = CUTOFF_DOW.has(dow);
                const isToday =
                  viewYear === todayYear && viewMonth === todayMonth && day === todayDate;
                const isSelected =
                  parsed &&
                  parsed.getFullYear() === viewYear &&
                  parsed.getMonth() === viewMonth &&
                  parsed.getDate() === day;

                return (
                  <button
                    key={day}
                    type="button"
                    onClick={() => pickDay(day)}
                    className={`relative flex flex-col items-center justify-center rounded-lg py-1.5 text-sm transition-colors ${
                      isSelected
                        ? "bg-blue-600 text-white"
                        : isToday
                        ? "ring-1 ring-inset ring-blue-400 text-slate-800 hover:bg-blue-50"
                        : "text-slate-700 hover:bg-slate-100"
                    }`}
                  >
                    {day}
                    {isCutoff && (
                      <span
                        className={`absolute bottom-0.5 h-1 w-1 rounded-full ${
                          isSelected ? "bg-blue-200" : "bg-orange-400"
                        }`}
                      />
                    )}
                  </button>
                );
              })}
            </div>

            {/* Legend */}
            <div className="mt-2 flex items-center gap-1.5 rounded-lg bg-orange-50 px-2.5 py-1.5">
              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-orange-400" />
              <span className="text-[11px] text-orange-600">
                วันพุทธ & วันศุกร์ = ตัดรอบ 10:00 น. อัตโนมัติ
              </span>
            </div>
          </div>

          {/* Time picker */}
          <div className="flex items-center gap-2 border-t border-slate-100 bg-slate-50 px-4 py-3">
            <Clock size={14} className="shrink-0 text-slate-400" />
            <span className="text-xs text-slate-500">เวลา</span>

            {/* ชั่วโมง */}
            <select
              value={selHour}
              onChange={(e) => applyTime(parseInt(e.target.value), selMinute)}
              className="rounded-md border border-slate-200 bg-white px-1.5 py-1 text-sm focus:border-blue-400 focus:outline-none"
            >
              {Array.from({ length: 24 }).map((_, h) => (
                <option key={h} value={h}>
                  {String(h).padStart(2, "0")}
                </option>
              ))}
            </select>

            <span className="font-semibold text-slate-400">:</span>

            {/* นาที (0, 5, 10, ..., 55) */}
            <select
              value={selMinute}
              onChange={(e) => applyTime(selHour, parseInt(e.target.value))}
              className="rounded-md border border-slate-200 bg-white px-1.5 py-1 text-sm focus:border-blue-400 focus:outline-none"
            >
              {Array.from({ length: 12 }).map((_, i) => {
                const m = i * 5;
                return (
                  <option key={m} value={m}>
                    {String(m).padStart(2, "0")}
                  </option>
                );
              })}
            </select>

            <button
              type="button"
              onClick={() => setOpen(false)}
              className="ml-auto rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700"
            >
              ตกลง
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
