"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";

const TONES = {
  slate:  { iconBg: "bg-slate-100",   iconText: "text-slate-600" },
  blue:   { iconBg: "bg-blue-100",    iconText: "text-blue-600" },
  green:  { iconBg: "bg-green-100",   iconText: "text-green-600" },
  violet: { iconBg: "bg-violet-100",  iconText: "text-violet-600" },
  amber:  { iconBg: "bg-amber-100",   iconText: "text-amber-600" },
  red:    { iconBg: "bg-red-100",     iconText: "text-red-600" },
  emerald:{ iconBg: "bg-emerald-100", iconText: "text-emerald-600" },
} as const;

interface GuideSectionProps {
  title: string;
  subtitle?: string;
  icon: React.ElementType;
  tone?: keyof typeof TONES;
  /** เปิดอ่านตั้งแต่แรก */
  defaultOpen?: boolean;
  children: React.ReactNode;
}

/** หัวข้อคู่มือแบบกดกาง/พับ — เนื้อหาอยู่ข้างในอ่านทีละเรื่อง */
export function GuideSection({
  title,
  subtitle,
  icon: Icon,
  tone = "slate",
  defaultOpen = false,
  children,
}: GuideSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const colors = TONES[tone];

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <button
        onClick={() => setIsOpen((prev) => !prev)}
        className="flex w-full items-center gap-3 px-5 py-4 text-left transition hover:bg-slate-50"
      >
        <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${colors.iconBg}`}>
          <Icon size={20} className={colors.iconText} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-semibold text-slate-800">{title}</span>
          {subtitle && <span className="block truncate text-xs text-slate-400">{subtitle}</span>}
        </span>
        <ChevronDown
          size={18}
          className={`shrink-0 text-slate-400 transition-transform ${isOpen ? "rotate-180" : ""}`}
        />
      </button>

      {isOpen && (
        <div className="border-t border-slate-100 px-5 py-4">
          <div className="prose-sm max-w-none space-y-3 text-sm leading-6 text-slate-600 [&_h4]:mb-1 [&_h4]:mt-4 [&_h4]:text-[13px] [&_h4]:font-bold [&_h4]:text-slate-700 [&_li]:mt-1 [&_ol]:list-decimal [&_ol]:pl-5 [&_ul]:list-disc [&_ul]:pl-5">
            {children}
          </div>
        </div>
      )}
    </div>
  );
}
