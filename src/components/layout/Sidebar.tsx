"use client";
import { useState, Suspense } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import {
  FileText,
  CheckSquare,
  Settings,
  ChevronDown,
  ChevronRight,
  Plus,
} from "lucide-react";
import { APP_NAME } from "@/lib/constants";
import type { UserRole } from "@/types/database";

const MY_WORK_SUB = [
  { href: "/requisitions",        step: null, label: "ทั้งหมด" },
  { href: "/requisitions?step=0", step: "0",  label: "ร่าง / ตีกลับ" },
  { href: "/requisitions?step=1", step: "1",  label: "รออนุมัติ" },
  { href: "/requisitions?step=2", step: "2",  label: "รอสร้าง PO" },
  { href: "/requisitions?step=3", step: "3",  label: "มี PO" },
  { href: "/requisitions/new",    step: null, label: "+ สร้าง PR" },
];

// ── MyWorkDropdown ──────────────────────────────────────────────────────────
// แยกออกมาระดับ module เพื่อให้ state ไม่ถูก reset เมื่อ parent re-render

function MyWorkDropdown({ pathname }: { pathname: string }) {
  const searchParams = useSearchParams();
  const currentStep = searchParams?.get("step") ?? null;
  const isOnMyWork = pathname.startsWith("/requisitions");
  const [open, setOpen] = useState(isOnMyWork);

  return (
    <div>
      <button
        onClick={() => setOpen((o) => !o)}
        className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
          isOnMyWork
            ? "bg-blue-600 text-white"
            : "text-slate-300 hover:bg-slate-800 hover:text-white"
        }`}
      >
        <FileText size={17} />
        <span className="flex-1 text-left">งานของฉัน</span>
        {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
      </button>

      {open && (
        <div className="ml-6 mt-0.5 space-y-0.5 border-l border-slate-700 pl-3">
          {MY_WORK_SUB.map((sub) => {
            const isNew = sub.href === "/requisitions/new";
            const isActive =
              pathname === "/requisitions" &&
              sub.step === currentStep;

            return (
              <Link
                key={sub.href}
                href={sub.href}
                className={`flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs transition-colors ${
                  isNew
                    ? "font-semibold text-blue-400 hover:text-blue-300"
                    : isActive
                    ? "bg-slate-700 font-semibold text-white"
                    : "text-slate-400 hover:bg-slate-800 hover:text-white"
                }`}
              >
                {isNew && <Plus size={11} />}
                {sub.label}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Sidebar ─────────────────────────────────────────────────────────────────

interface SidebarProps {
  role?: UserRole;
}

export function Sidebar({ role }: SidebarProps) {
  const pathname = usePathname() ?? "/";
  const isAdmin = role === "admin";

  const isApprovalsActive = pathname.startsWith("/approvals");

  return (
    <aside className="hidden lg:flex lg:flex-col w-64 min-h-screen bg-slate-900 text-white shrink-0">
      {/* Logo */}
      <div className="px-6 py-5 border-b border-slate-700">
        <span className="font-bold text-sm text-white">{APP_NAME}</span>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-0.5">
        <p className="mb-1.5 px-3 text-[10px] font-semibold uppercase tracking-widest text-slate-500">
          จัดซื้อทั่วไป
        </p>

        {/* งานของฉัน */}
        <Suspense fallback={
          <button className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-slate-300">
            <FileText size={17} /><span>งานของฉัน</span>
          </button>
        }>
          <MyWorkDropdown pathname={pathname} />
        </Suspense>

        {/* การอนุมัติ */}
        <Link
          href="/approvals"
          className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
            isApprovalsActive
              ? "bg-blue-600 text-white"
              : "text-slate-300 hover:bg-slate-800 hover:text-white"
          }`}
        >
          <CheckSquare size={17} />
          การอนุมัติ
        </Link>
      </nav>

      {/* Admin */}
      {isAdmin && (
        <div className="px-3 py-3 border-t border-slate-700">
          <p className="mb-1.5 px-3 text-[10px] font-semibold uppercase tracking-widest text-slate-500">
            จัดการระบบ
          </p>
          <Link
            href="/settings/users"
            className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
              pathname.startsWith("/settings")
                ? "bg-blue-600 text-white"
                : "text-slate-300 hover:bg-slate-800 hover:text-white"
            }`}
          >
            <Settings size={17} />
            จัดการผู้ใช้
          </Link>
        </div>
      )}
    </aside>
  );
}
