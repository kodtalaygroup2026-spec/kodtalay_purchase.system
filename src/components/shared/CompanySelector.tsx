"use client";

import { Building2, ChevronDown, Check } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import type { Branch } from "@/types/database";

const BRANCH_COLORS: Record<string, { border: string; bg: string; text: string; badge: string }> = {
  CK: {
    border: "border-l-blue-500",
    bg: "bg-blue-600",
    text: "text-blue-700",
    badge: "bg-blue-50 text-blue-700 border-blue-200",
  },
  BN: {
    border: "border-l-emerald-500",
    bg: "bg-emerald-600",
    text: "text-emerald-700",
    badge: "bg-emerald-50 text-emerald-700 border-emerald-200",
  },
  RCA: {
    border: "border-l-orange-500",
    bg: "bg-orange-500",
    text: "text-orange-700",
    badge: "bg-orange-50 text-orange-700 border-orange-200",
  },
};

const DEFAULT_COLOR = {
  border: "border-l-slate-400",
  bg: "bg-slate-600",
  text: "text-slate-700",
  badge: "bg-slate-50 text-slate-700 border-slate-200",
};

interface CompanySelectorProps {
  branches: Branch[];
  selectedId: string;
  onChange: (id: string) => void;
  compact?: boolean;
}

export function CompanySelector({ branches, selectedId, onChange, compact = false }: CompanySelectorProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const selectedBranch = branches.find((b) => b.id === selectedId);
  const colors = selectedBranch
    ? (BRANCH_COLORS[selectedBranch.code] ?? DEFAULT_COLOR)
    : DEFAULT_COLOR;

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  if (compact) {
    return (
      <div className="relative" ref={ref}>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className={`flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 shadow-sm hover:border-slate-300 hover:bg-slate-50 transition-colors`}
        >
          <div className={`flex h-5 w-5 items-center justify-center rounded-md ${colors.bg}`}>
            <Building2 size={11} className="text-white" />
          </div>
          <span>{selectedBranch?.name ?? "เลือกบริษัท"}</span>
          <ChevronDown size={13} className={`ml-0.5 transition-transform ${open ? "rotate-180" : ""}`} />
        </button>
        {open && (
          <div className="absolute left-0 top-full z-20 mt-1 w-52 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">
            {branches.map((branch) => {
              const c = BRANCH_COLORS[branch.code] ?? DEFAULT_COLOR;
              const isSelected = branch.id === selectedId;
              return (
                <button
                  key={branch.id}
                  type="button"
                  onClick={() => { onChange(branch.id); setOpen(false); }}
                  className={`flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-sm transition-colors hover:bg-slate-50 ${isSelected ? "bg-slate-50" : ""}`}
                >
                  <div className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md ${c.bg}`}>
                    <Building2 size={12} className="text-white" />
                  </div>
                  <span className="flex-1 font-medium text-slate-700">{branch.name}</span>
                  {isSelected && <Check size={14} className="text-blue-600" />}
                </button>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {/* Dropdown trigger */}
      <div className="relative" ref={ref}>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className={`flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm hover:border-slate-300 hover:bg-slate-50 transition-colors`}
        >
          <div className={`flex h-6 w-6 items-center justify-center rounded-md ${colors.bg}`}>
            <Building2 size={13} className="text-white" />
          </div>
          <span>{selectedBranch?.name ?? "เลือกบริษัท"}</span>
          <ChevronDown size={14} className={`ml-1 transition-transform ${open ? "rotate-180" : ""}`} />
        </button>

        {open && (
          <div className="absolute left-0 top-full z-20 mt-1 w-52 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">
            {branches.map((branch) => {
              const c = BRANCH_COLORS[branch.code] ?? DEFAULT_COLOR;
              const isSelected = branch.id === selectedId;
              return (
                <button
                  key={branch.id}
                  type="button"
                  onClick={() => { onChange(branch.id); setOpen(false); }}
                  className={`flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-sm transition-colors hover:bg-slate-50 ${
                    isSelected ? "bg-slate-50" : ""
                  }`}
                >
                  <div className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md ${c.bg}`}>
                    <Building2 size={12} className="text-white" />
                  </div>
                  <span className="flex-1 font-medium text-slate-700">{branch.name}</span>
                  {isSelected && <Check size={14} className="text-blue-600" />}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Confirmation chip */}
      {selectedBranch && (
        <div className={`inline-flex items-center gap-1.5 self-start rounded-full border px-2.5 py-1 text-xs font-medium ${colors.badge}`}>
          <Check size={11} />
          กำลังออกในนาม {selectedBranch.name}
        </div>
      )}
    </div>
  );
}

/** คืน className สำหรับ border-l-4 ตาม branch code */
export function getBranchBorderColor(code: string | undefined): string {
  if (!code) return "border-l-slate-300";
  return BRANCH_COLORS[code]?.border ?? "border-l-slate-300";
}
