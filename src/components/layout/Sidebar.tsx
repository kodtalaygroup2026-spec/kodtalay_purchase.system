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
  Pencil,
} from "lucide-react";
import { APP_NAME } from "@/lib/constants";
import type { UserRole } from "@/types/database";

const MY_WORK_SUB_BASE = [
  { href: "/requisitions?step=1", step: "1",  label: "งานอนุมัติ",  financeOnly: false },
  { href: "/disbursement",        step: null, label: "งานแนบจ่าย", financeOnly: true  },
  { href: "/requisitions",        step: null, label: "งานเอกสาร",  financeOnly: false },
  { href: "/requisitions/new",    step: null, label: "สร้าง PR",    financeOnly: false },
];

// ── MyWorkDropdown ──────────────────────────────────────────────────────────
// แยกออกมาระดับ module เพื่อให้ state ไม่ถูก reset เมื่อ parent re-render

function MyWorkDropdown({ pathname, role }: { pathname: string; role?: UserRole }) {
  const searchParams = useSearchParams();
  const currentStep = searchParams?.get("step") ?? null;
  const isOnMyWork = pathname.startsWith("/requisitions") || pathname.startsWith("/disbursement");
  const [open, setOpen] = useState(isOnMyWork);

  const isFinance = role === "finance" || role === "admin";
  const MY_WORK_SUB = MY_WORK_SUB_BASE.filter(s => !s.financeOnly || isFinance);

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
            const isActive = sub.step !== null
              ? pathname === "/requisitions" && sub.step === currentStep
              : sub.href === "/requisitions"
                ? pathname === "/requisitions" && currentStep === null
                : sub.href === "/requisitions/new"
                  ? pathname === "/requisitions/new"
                  : pathname.startsWith(sub.href);

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

// ── ApprovalsDropdown ────────────────────────────────────────────────────────

function ApprovalsDropdown({
  pathname,
  approvalCount,
  editedCount,
}: {
  pathname: string;
  approvalCount: number;
  editedCount: number;
}) {
  const isOnApprovals = pathname.startsWith("/approvals");
  const [open, setOpen] = useState(isOnApprovals);

  return (
    <div>
      <button
        onClick={() => setOpen((o) => !o)}
        className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
          isOnApprovals
            ? "bg-blue-600 text-white"
            : "text-slate-300 hover:bg-slate-800 hover:text-white"
        }`}
      >
        <CheckSquare size={17} />
        <span className="flex-1 text-left">การอนุมัติ</span>
        {approvalCount > 0 && (
          <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1.5 text-[11px] font-bold text-white">
            {approvalCount > 99 ? "99+" : approvalCount}
          </span>
        )}
        {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
      </button>

      {open && (
        <div className="ml-6 mt-0.5 space-y-0.5 border-l border-slate-700 pl-3">
          {/* รออนุมัติ */}
          <Link
            href="/approvals"
            className={`flex items-center justify-between rounded-md px-2 py-1.5 text-xs transition-colors ${
              pathname === "/approvals"
                ? "bg-slate-700 font-semibold text-white"
                : "text-slate-400 hover:bg-slate-800 hover:text-white"
            }`}
          >
            <span>รออนุมัติ</span>
            {approvalCount > 0 && (
              <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                {approvalCount > 99 ? "99+" : approvalCount}
              </span>
            )}
          </Link>

          {/* รายการแก้ไข */}
          <Link
            href="/approvals/edited-items"
            className={`flex items-center justify-between rounded-md px-2 py-1.5 text-xs transition-colors ${
              pathname.startsWith("/approvals/edited-items")
                ? "bg-slate-700 font-semibold text-white"
                : "text-slate-400 hover:bg-slate-800 hover:text-white"
            }`}
          >
            <span className="flex items-center gap-1">
              <Pencil size={10} />
              รายการแก้ไข
            </span>
            {editedCount > 0 && (
              <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-500 px-1 text-[10px] font-bold text-white">
                {editedCount > 99 ? "99+" : editedCount}
              </span>
            )}
          </Link>
        </div>
      )}
    </div>
  );
}

// ── Sidebar ─────────────────────────────────────────────────────────────────

interface SidebarProps {
  role?: UserRole;
  approvalCount?: number;
  editedCount?: number;
}

export function Sidebar({ role, approvalCount = 0, editedCount = 0 }: SidebarProps) {
  const pathname = usePathname() ?? "/";
  const isAdmin = role === "admin";

  if (pathname === "/") return null;

  return (
    <aside className="hidden lg:flex lg:flex-col w-64 min-h-screen bg-slate-900 text-white shrink-0">
      {/* Logo */}
      <div className="px-6 py-5 border-b border-slate-700">
        <Link href="/" className="font-bold text-sm text-white hover:text-slate-300 transition-colors">
          {APP_NAME}
        </Link>
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
          <MyWorkDropdown pathname={pathname} role={role} />
        </Suspense>

        {/* การอนุมัติ */}
        <ApprovalsDropdown
          pathname={pathname}
          approvalCount={approvalCount}
          editedCount={editedCount}
        />
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
