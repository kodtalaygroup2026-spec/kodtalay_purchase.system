"use client";

import { useState } from "react";
import { ChevronUp, ChevronDown, ChevronsUpDown } from "lucide-react";

export type SortDir = "asc" | "desc";

interface SortThProps {
  label: string;
  col: string;
  activeCol: string;
  dir: SortDir;
  onSort: (col: string) => void;
  className?: string;
  align?: "left" | "right" | "center";
}

export function SortTh({
  label, col, activeCol, dir, onSort, className = "", align = "left",
}: SortThProps) {
  const isActive = activeCol === col;
  const alignClass =
    align === "right" ? "justify-end" : align === "center" ? "justify-center" : "justify-start";
  return (
    <th className={`px-4 py-3 ${className}`}>
      <button
        onClick={() => onSort(col)}
        className={`flex w-full items-center gap-1 font-medium text-slate-500 hover:text-slate-700 group ${alignClass}`}
      >
        {label}
        <span className={`transition ${isActive ? "text-blue-500" : "text-slate-300 group-hover:text-slate-400"}`}>
          {isActive
            ? dir === "asc" ? <ChevronUp size={13} /> : <ChevronDown size={13} />
            : <ChevronsUpDown size={13} />}
        </span>
      </button>
    </th>
  );
}

export function useSortable<T>(items: T[], defaultKey: keyof T & string, defaultDir: SortDir = "asc") {
  const [sortKey, setSortKey] = useState<string>(defaultKey);
  const [sortDir, setSortDir] = useState<SortDir>(defaultDir);

  function handleSort(col: string) {
    if (col === sortKey) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(col); setSortDir("asc"); }
  }

  const sorted = [...items].sort((a, b) => {
    const av = (a as Record<string, unknown>)[sortKey] ?? "";
    const bv = (b as Record<string, unknown>)[sortKey] ?? "";
    const an = typeof av === "number" ? av : String(av).toLowerCase();
    const bn = typeof bv === "number" ? bv : String(bv).toLowerCase();
    if (an < bn) return sortDir === "asc" ? -1 : 1;
    if (an > bn) return sortDir === "asc" ? 1 : -1;
    return 0;
  });

  return { sorted, sortKey, sortDir, handleSort };
}
