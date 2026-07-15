"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown } from "lucide-react";

const VIEWPORT_MARGIN = 8;
const MIN_PANEL_WIDTH = 210;

export interface FilterOption<T extends string> {
  value: T;
  label: string;
}

interface FilterDropdownProps<T extends string> {
  value: T;
  onChange: (value: T) => void;
  options: FilterOption<T>[];
  /** ป้ายนำหน้าค่าบนปุ่ม เช่น "เรียง" → "เรียง: วันที่ล่าสุดก่อน" */
  prefix?: string;
  /** ไอคอนหน้าปุ่ม (จาก lucide) */
  icon?: React.ElementType;
  /** ค่าเริ่มต้น — ถ้าเลือกค่าอื่นอยู่ ปุ่มจะเป็นโทนน้ำเงินให้รู้ว่ากรองอยู่ */
  defaultValue?: T;
}

/**
 * Dropdown แบบแต่งเองสำหรับแถบกรอง/เรียงลำดับ — แทน <select> ของเบราว์เซอร์
 * ที่ป๊อปอัปแต่งสไตล์ไม่ได้ แผงเรนเดอร์ผ่าน portal จึงไม่โดนการ์ดตาราง
 * ที่มี overflow-hidden ตัดขอบ (แพตเทิร์นเดียวกับ DateRangePicker)
 */
export function FilterDropdown<T extends string>({
  value,
  onChange,
  options,
  prefix,
  icon: Icon = ChevronDown,
  defaultValue,
}: FilterDropdownProps<T>) {
  const [isOpen, setIsOpen] = useState(false);
  const [position, setPosition] = useState<{ top: number; left: number; width: number } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const activeOption = options.find((o) => o.value === value);
  const isDefault = defaultValue !== undefined && value === defaultValue;

  // วางแผงแบบ fixed อ้างอิงจากปุ่ม — หลุดจากทุกกล่องที่ overflow-hidden
  useLayoutEffect(() => {
    if (!isOpen) return;

    function reposition() {
      const trigger = triggerRef.current;
      if (!trigger) return;
      const rect = trigger.getBoundingClientRect();
      const width = Math.max(rect.width, MIN_PANEL_WIDTH);
      const panelHeight = panelRef.current?.offsetHeight ?? 240;

      const maxLeft = window.innerWidth - width - VIEWPORT_MARGIN;
      const left = Math.max(VIEWPORT_MARGIN, Math.min(rect.left, maxLeft));

      const spaceBelow = window.innerHeight - rect.bottom;
      const openUp = spaceBelow < panelHeight + VIEWPORT_MARGIN && rect.top > spaceBelow;
      const top = openUp
        ? Math.max(VIEWPORT_MARGIN, rect.top - panelHeight - 6)
        : rect.bottom + 6;

      setPosition({ top, left, width });
    }

    reposition();
    window.addEventListener("scroll", reposition, true);
    window.addEventListener("resize", reposition);
    return () => {
      window.removeEventListener("scroll", reposition, true);
      window.removeEventListener("resize", reposition);
    };
  }, [isOpen]);

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

  function select(next: T) {
    onChange(next);
    setIsOpen(false);
  }

  const panel = isOpen ? (
    <div
      ref={panelRef}
      style={{
        position: "fixed",
        top: position?.top ?? -9999,
        left: position?.left ?? -9999,
        width: position?.width,
        visibility: position ? "visible" : "hidden",
      }}
      className="z-50 max-h-[300px] overflow-y-auto rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl"
    >
      {options.map((option) => {
        const isActive = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => select(option.value)}
            className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-sm transition ${
              isActive ? "bg-blue-50 font-semibold text-blue-700" : "text-slate-600 hover:bg-slate-50"
            }`}
          >
            <span className="flex-1 truncate text-left">{option.label}</span>
            {isActive && <Check size={13} className="shrink-0 text-blue-600" />}
          </button>
        );
      })}
    </div>
  ) : null;

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className={`flex h-[38px] items-center gap-2 rounded-lg border px-3 text-sm transition ${
          isDefault
            ? "border-slate-300 bg-white text-slate-600 hover:border-slate-400"
            : "border-blue-400 bg-blue-50/60 font-medium text-blue-800"
        }`}
      >
        {Icon !== ChevronDown && (
          <Icon size={14} className={isDefault ? "text-slate-400" : "text-blue-500"} />
        )}
        <span className="truncate">
          {prefix ? `${prefix}: ` : ""}
          {activeOption?.label ?? "—"}
        </span>
        <ChevronDown
          size={15}
          className={`shrink-0 transition ${isOpen ? "rotate-180" : ""} ${isDefault ? "text-slate-400" : "text-blue-400"}`}
        />
      </button>

      {typeof document !== "undefined" && panel ? createPortal(panel, document.body) : null}
    </>
  );
}
