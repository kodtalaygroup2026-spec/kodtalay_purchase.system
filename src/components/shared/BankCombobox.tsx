"use client";

import { useState, useRef, useEffect } from "react";
import { ChevronDown, Check, Plus } from "lucide-react";
import { BANK_FORMATS } from "@/lib/utils/bankFormats";

// ช่องเลือกธนาคาร — เลือกจากรายการธนาคารที่รู้จัก หรือ "พิมพ์ชื่อธนาคารเอง" ก็ได้
// value = bank code ของธนาคารในลิสต์ (เช่น "KBANK") หรือชื่อธนาคารที่พิมพ์เอง (ข้อความอิสระ)
// การตรวจเลขบัญชี (mask) จะทำงานเฉพาะธนาคารในลิสต์ ส่วนธนาคารที่พิมพ์เองจะกรอกเลขได้อิสระ

interface BankComboboxProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export function BankCombobox({
  value,
  onChange,
  placeholder = "พิมพ์หรือเลือกธนาคาร...",
}: BankComboboxProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [highlight, setHighlight] = useState(0);
  const wrapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const highlightRef = useRef<HTMLButtonElement>(null);

  // ชื่อที่โชว์ในช่อง: ถ้า value ตรงกับ code ในลิสต์ให้โชว์ label เต็ม ไม่งั้นโชว์ข้อความที่พิมพ์เอง
  const known = BANK_FORMATS.find((b) => b.code === value) ?? null;
  const selectedLabel = known ? known.label : value;

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
  const filtered = BANK_FORMATS.filter(
    (b) => !q || b.label.toLowerCase().includes(q) || b.code.toLowerCase().includes(q)
  );

  // เสนอ "ใช้ธนาคารที่พิมพ์เอง" เมื่อพิมพ์ชื่อที่ยังไม่ตรงกับธนาคารในลิสต์
  const typed = query.trim();
  const exactMatch = BANK_FORMATS.some(
    (b) => b.label.toLowerCase() === typed.toLowerCase() || b.code.toLowerCase() === typed.toLowerCase()
  );
  const showCustom = typed.length > 0 && !exactMatch;

  const navCount = filtered.length + (showCustom ? 1 : 0);
  const customIndex = showCustom ? filtered.length : -1;

  useEffect(() => { setHighlight(0); }, [query, open]);
  useEffect(() => { highlightRef.current?.scrollIntoView({ block: "nearest" }); }, [highlight]);

  function pick(code: string) {
    onChange(code);
    setOpen(false);
    setQuery("");
  }

  function applyCustom() {
    const name = query.trim();
    if (!name) return;
    onChange(name);
    setOpen(false);
    setQuery("");
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (!open) { setOpen(true); return; }
      setHighlight((h) => Math.min(h + 1, navCount - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
    } else if (e.key === "Enter") {
      if (!open) return;
      e.preventDefault();
      if (highlight === customIndex) applyCustom();
      else if (filtered[highlight]) pick(filtered[highlight].code);
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
        className={`flex cursor-text items-center gap-2 rounded-lg border bg-white px-3 py-2 transition ${
          open ? "border-blue-500 ring-4 ring-blue-100" : "border-slate-300 hover:border-slate-400"
        }`}
      >
        <input
          ref={inputRef}
          value={open ? query : selectedLabel}
          onChange={(e) => { setQuery(e.target.value); if (!open) setOpen(true); }}
          onFocusCapture={() => setOpen(true)}
          onFocus={() => { setOpen(true); setQuery(""); }}
          onKeyDown={handleKeyDown}
          placeholder={selectedLabel || placeholder}
          className="flex-1 bg-transparent text-sm text-slate-700 outline-none placeholder:text-slate-400"
        />
        <ChevronDown
          size={16}
          className={`shrink-0 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </div>

      {/* ดรอปลิสต์ */}
      {open && (
        <div className="absolute z-30 mt-1.5 max-h-64 w-full overflow-auto rounded-xl border border-slate-200 bg-white py-1 shadow-xl ring-1 ring-black/5">
          {filtered.map((b, idx) => {
            const isSel = b.code === value;
            const isHi = idx === highlight;
            return (
              <button
                type="button"
                key={b.code}
                ref={isHi ? highlightRef : null}
                onClick={() => pick(b.code)}
                onMouseEnter={() => setHighlight(idx)}
                className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition ${
                  isHi
                    ? "bg-blue-100 text-blue-800"
                    : isSel
                    ? "bg-blue-50 text-blue-700"
                    : "text-slate-700 hover:bg-slate-50"
                }`}
              >
                <span className="flex-1">{b.label}</span>
                {isSel && <Check size={14} className="shrink-0 text-blue-600" />}
              </button>
            );
          })}

          {filtered.length === 0 && !showCustom && (
            <p className="px-3 py-3 text-center text-xs text-slate-400">
              ไม่พบธนาคารที่ตรงกับ &quot;{query}&quot;
            </p>
          )}

          {/* ใช้ชื่อธนาคารที่พิมพ์เอง */}
          {showCustom && (
            <>
              {filtered.length > 0 && <div className="my-1 border-t border-slate-100" />}
              <button
                type="button"
                ref={highlight === customIndex ? highlightRef : null}
                onClick={applyCustom}
                onMouseEnter={() => setHighlight(customIndex)}
                className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition ${
                  highlight === customIndex ? "bg-emerald-100 text-emerald-800" : "text-emerald-700 hover:bg-emerald-50"
                }`}
              >
                <Plus size={14} className="shrink-0" />
                <span className="flex-1">
                  ใช้ธนาคาร <span className="font-semibold">&ldquo;{typed}&rdquo;</span>
                </span>
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
