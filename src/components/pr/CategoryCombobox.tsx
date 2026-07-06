"use client";

import { useState, useRef, useEffect } from "react";
import { ChevronDown, Check } from "lucide-react";

export interface CategoryOpt {
  id: string;
  code: string | null;
  name: string;
  mode: number;
  is_active: boolean;
  position_id: string | null;
}

const MODE_LABELS: Record<number, string> = {
  1: "MODE 1 · จัดซื้อทั่วไป",
  2: "MODE 2 · ช่าง (เร็วๆ นี้)",
};

interface CategoryComboboxProps {
  categories: CategoryOpt[];
  value: string;
  onChange: (id: string) => void;
  placeholder?: string;
}

export function CategoryCombobox({
  categories,
  value,
  onChange,
  placeholder = "พิมพ์หรือเลือกหมวด...",
}: CategoryComboboxProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [highlight, setHighlight] = useState(0);
  const wrapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const highlightRef = useRef<HTMLButtonElement>(null);

  const selected = categories.find((c) => c.id === value) ?? null;
  const selectedLabel = selected
    ? `${selected.code ? `[${selected.code}] ` : ""}${selected.name}`
    : "";

  // ปิดเมื่อคลิกนอกกรอบ
  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery("");
      }
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  const q = query.trim().toLowerCase();
  const matches = (c: CategoryOpt) =>
    !q || (c.code ?? "").toLowerCase().includes(q) || c.name.toLowerCase().includes(q);

  const modes = [...new Set(categories.map((c) => c.mode))].sort((a, b) => a - b);
  const anyMatch = categories.some((c) => matches(c));

  // รายการที่เลื่อนด้วยคีย์บอร์ดได้ (active + ตรงกับที่พิมพ์) เรียงตามที่แสดง
  const navItems = modes.flatMap((mode) =>
    categories.filter((c) => c.mode === mode && matches(c) && c.is_active)
  );

  // รีเซ็ตตัวไฮไลต์เมื่อเปิด/พิมพ์
  useEffect(() => { setHighlight(0); }, [query, open]);

  // เลื่อนให้ตัวไฮไลต์อยู่ในมุมมอง
  useEffect(() => { highlightRef.current?.scrollIntoView({ block: "nearest" }); }, [highlight]);

  function pick(c: CategoryOpt) {
    if (!c.is_active) return;
    onChange(c.id);
    setOpen(false);
    setQuery("");
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (!open) { setOpen(true); return; }
      setHighlight((h) => Math.min(h + 1, navItems.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
    } else if (e.key === "Enter") {
      if (open && navItems[highlight]) {
        e.preventDefault();
        pick(navItems[highlight]);
      }
    } else if (e.key === "Escape") {
      setOpen(false);
      setQuery("");
      inputRef.current?.blur();
    }
  }

  return (
    <div ref={wrapRef} className="relative">
      {/* ช่องพิมพ์ */}
      <div
        onClick={() => { setOpen(true); inputRef.current?.focus(); }}
        className={`flex cursor-text items-center gap-2 rounded-xl border bg-white px-3.5 py-2.5 transition ${
          open ? "border-blue-500 ring-4 ring-blue-100" : "border-slate-300 hover:border-slate-400"
        }`}
      >
        <input
          ref={inputRef}
          value={open ? query : selectedLabel}
          onChange={(e) => { setQuery(e.target.value); if (!open) setOpen(true); }}
          onFocus={() => { setOpen(true); setQuery(""); }}
          onKeyDown={handleKeyDown}
          placeholder={selected ? selectedLabel : placeholder}
          className="flex-1 bg-transparent text-sm text-slate-800 outline-none placeholder:text-slate-400"
        />
        <ChevronDown
          size={16}
          className={`shrink-0 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </div>

      {/* ดรอปลิสต์ */}
      {open && (
        <div className="absolute z-20 mt-1.5 max-h-72 w-full overflow-auto rounded-xl border border-slate-200 bg-white py-1 shadow-xl ring-1 ring-black/5">
          {modes.map((mode) => {
            const items = categories.filter((c) => c.mode === mode && matches(c));
            if (items.length === 0) return null;
            return (
              <div key={mode}>
                <p className="px-3 pb-1 pt-2 text-[10px] font-bold uppercase tracking-wide text-slate-400">
                  {MODE_LABELS[mode] ?? `MODE ${mode}`}
                </p>
                {items.map((c) => {
                  const isSel = c.id === value;
                  const isHi = c.is_active && navItems[highlight]?.id === c.id;
                  return (
                    <button
                      type="button"
                      key={c.id}
                      ref={isHi ? highlightRef : null}
                      onClick={() => pick(c)}
                      onMouseEnter={() => {
                        const idx = navItems.findIndex((n) => n.id === c.id);
                        if (idx >= 0) setHighlight(idx);
                      }}
                      disabled={!c.is_active}
                      className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition ${
                        !c.is_active
                          ? "cursor-not-allowed text-slate-300"
                          : isHi
                          ? "bg-blue-100 text-blue-800"
                          : isSel
                          ? "bg-blue-50 text-blue-700"
                          : "text-slate-700 hover:bg-slate-50"
                      }`}
                    >
                      {c.code && (
                        <span
                          className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold ${
                            !c.is_active ? "bg-slate-100 text-slate-300" : "bg-slate-100 text-slate-500"
                          }`}
                        >
                          {c.code}
                        </span>
                      )}
                      <span className="flex-1">
                        {c.name}
                        {!c.is_active && " (เร็วๆ นี้)"}
                      </span>
                      {isSel && <Check size={14} className="shrink-0 text-blue-600" />}
                    </button>
                  );
                })}
              </div>
            );
          })}
          {!anyMatch && (
            <p className="px-3 py-3 text-center text-xs text-slate-400">
              ไม่พบหมวดที่ตรงกับ &quot;{query}&quot;
            </p>
          )}
        </div>
      )}
    </div>
  );
}
