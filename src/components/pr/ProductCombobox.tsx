"use client";

import { useState, useRef, useEffect } from "react";
import { ChevronDown, Check, X } from "lucide-react";

export interface ProductOpt {
  id: string;
  sku: string;
  name: string;
  unit: string;
  unit_price: number;
}

interface ProductComboboxProps {
  products: ProductOpt[];
  value: string;                    // product_id ("" = ยังไม่เลือก)
  onChange: (productId: string) => void;
  placeholder?: string;
  className?: string;
}

export function ProductCombobox({
  products,
  value,
  onChange,
  placeholder = "ระบุสินค้าเพิ่ม",
  className = "w-56",
}: ProductComboboxProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [highlight, setHighlight] = useState(0);
  const wrapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const highlightRef = useRef<HTMLButtonElement>(null);

  const selected = products.find((p) => p.id === value) ?? null;
  const selectedLabel = selected ? `[${selected.sku}] ${selected.name}` : "";

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
  const matches = products.filter(
    (p) => !q || p.sku.toLowerCase().includes(q) || p.name.toLowerCase().includes(q)
  );

  useEffect(() => { setHighlight(0); }, [query, open]);
  useEffect(() => { highlightRef.current?.scrollIntoView({ block: "nearest" }); }, [highlight]);

  function pick(p: ProductOpt) {
    onChange(p.id);
    setOpen(false);
    setQuery("");
  }

  function clear(e: React.MouseEvent) {
    e.stopPropagation();
    onChange("");
    setQuery("");
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (!open) { setOpen(true); return; }
      setHighlight((h) => Math.min(h + 1, matches.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
    } else if (e.key === "Enter") {
      if (open && matches[highlight]) { e.preventDefault(); pick(matches[highlight]); }
    } else if (e.key === "Escape") {
      setOpen(false);
      setQuery("");
      inputRef.current?.blur();
    }
  }

  return (
    <div ref={wrapRef} className={`relative ${className}`}>
      {/* กรอบช่อง */}
      <div
        onClick={() => { setOpen(true); inputRef.current?.focus(); }}
        className={`flex cursor-text items-center gap-1.5 rounded-lg border bg-white px-2.5 py-1.5 transition ${
          open
            ? "border-blue-500 ring-2 ring-blue-100"
            : selected
            ? "border-blue-200 bg-blue-50/40 hover:border-blue-300"
            : "border-slate-200 bg-slate-50 hover:border-slate-300"
        }`}
      >
        <input
          ref={inputRef}
          value={open ? query : selectedLabel}
          onChange={(e) => { setQuery(e.target.value); if (!open) setOpen(true); }}
          onFocus={() => { setOpen(true); setQuery(""); }}
          onKeyDown={handleKeyDown}
          placeholder={selected ? selectedLabel : placeholder}
          className="min-w-0 flex-1 bg-transparent text-xs text-slate-700 outline-none placeholder:text-slate-400"
        />
        {selected && !open && (
          <button type="button" onClick={clear} className="shrink-0 text-slate-300 hover:text-red-500">
            <X size={12} />
          </button>
        )}
        <ChevronDown
          size={13}
          className={`shrink-0 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </div>

      {/* ดรอปลิสต์ */}
      {open && (
        <div className="absolute z-30 mt-1 max-h-64 w-[min(22rem,80vw)] overflow-auto rounded-xl border border-slate-200 bg-white py-1 shadow-xl ring-1 ring-black/5">
          {matches.length === 0 ? (
            <p className="px-3 py-3 text-center text-xs text-slate-400">
              ไม่พบสินค้าที่ตรงกับ &quot;{query}&quot;
            </p>
          ) : (
            matches.map((p, i) => {
              const isSel = p.id === value;
              const isHi = i === highlight;
              return (
                <button
                  type="button"
                  key={p.id}
                  ref={isHi ? highlightRef : null}
                  onClick={() => pick(p)}
                  onMouseEnter={() => setHighlight(i)}
                  className={`flex w-full items-center gap-2 px-3 py-2 text-left text-xs transition ${
                    isHi ? "bg-blue-100 text-blue-800" : isSel ? "bg-blue-50 text-blue-700" : "text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  <span className="shrink-0 rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] font-bold text-slate-500">
                    {p.sku}
                  </span>
                  <span className="min-w-0 flex-1 truncate">{p.name}</span>
                  <span className="shrink-0 whitespace-nowrap text-[10px] text-slate-400">
                    ฿{Number(p.unit_price).toLocaleString("th-TH")} / {p.unit}
                  </span>
                  {isSel && <Check size={12} className="shrink-0 text-blue-600" />}
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
