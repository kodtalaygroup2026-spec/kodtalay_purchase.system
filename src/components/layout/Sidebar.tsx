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
  Landmark,
  PiggyBank,
  Users,
  FileCheck2,
  Building2,
  ListFilter,
  BookOpen,
} from "lucide-react";
import { APP_NAME } from "@/lib/constants";
import { KTB_ENABLED } from "@/lib/config/features";
import { useRealtimeFinanceCounts } from "@/hooks/useRealtimeFinanceCounts";
import { useRealtimeApprovalCount } from "@/hooks/useRealtimeApprovalCount";
import type { UserRole } from "@/types/database";

const MY_WORK_SUB_BASE = [
  { href: "/requisitions?step=1",       step: "1",  label: "งานอนุมัติ",         financeOnly: false },
  { href: "/requisitions",              step: null, label: "งานเอกสาร",         financeOnly: false },
  { href: "/requisitions/incomplete",   step: null, label: "งานเอกสารไม่สมบูรณ์", financeOnly: false },
  { href: "/requisitions/new",          step: null, label: "สร้าง PR",           financeOnly: false },
];

// ── MyWorkDropdown ──────────────────────────────────────────────────────────
// แยกออกมาระดับ module เพื่อให้ state ไม่ถูก reset เมื่อ parent re-render

function MyWorkDropdown({ pathname, role, incompleteCount = 0, todoCount = 0 }: { pathname: string; role?: UserRole; incompleteCount?: number; todoCount?: number }) {
  const searchParams = useSearchParams();
  const currentStep = searchParams?.get("step") ?? null;
  const isOnMyWork = pathname.startsWith("/requisitions");
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

            // badge แจ้งเตือนต่อเมนูย่อย
            const badge =
              sub.href === "/requisitions/incomplete" && incompleteCount > 0
                ? { count: incompleteCount, color: "bg-amber-500" }
                : sub.href === "/requisitions" && todoCount > 0
                ? { count: todoCount, color: "bg-red-500" }
                : null;

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
                <span className="flex-1">{sub.label}</span>
                {badge && (
                  <span className={`flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-bold text-white ${badge.color}`}>
                    {badge.count > 99 ? "99+" : badge.count}
                  </span>
                )}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── FinanceDropdown ──────────────────────────────────────────────────────────

const FINANCE_SUB = [
  { href: "/finance",            label: "รายการทั้งหมด",        icon: <ListFilter size={13} /> },
  { href: "/finance/payments",   label: "รายการบริษัทสั่งจ่าย", icon: <Building2 size={13} /> },
  { href: "/finance/petty-cash", label: "รายการเงินสดย่อย",     icon: <PiggyBank size={13} /> },
  { href: "/finance/documents",  label: "งานเอกสารสมบูรณ์",     icon: <FileCheck2 size={13} /> },
  // KTB Smart Transfer — ปิดชั่วคราว (เปิดที่ lib/config/features.ts)
  ...(KTB_ENABLED
    ? [{ href: "/finance/ktb", label: "KTB Smart Transfer", icon: <Landmark size={13} /> }]
    : []),
];

function FinanceDropdown({ pathname, companyCount = 0, pettyCashCount = 0 }: { pathname: string; companyCount?: number; pettyCashCount?: number }) {
  const isOnFinance = pathname.startsWith("/finance");
  const [open, setOpen] = useState(isOnFinance);

  return (
    <div>
      <button
        onClick={() => setOpen((o) => !o)}
        className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
          isOnFinance
            ? "bg-blue-600 text-white"
            : "text-slate-300 hover:bg-slate-800 hover:text-white"
        }`}
      >
        <Landmark size={17} />
        <span className="flex-1 text-left">การเงิน</span>
        {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
      </button>

      {open && (
        <div className="ml-6 mt-0.5 space-y-0.5 border-l border-slate-700 pl-3">
          {FINANCE_SUB.map((sub) => {
            const isExact = sub.href === "/finance";
            const isActive = isExact
              ? pathname === "/finance"
              : pathname.startsWith(sub.href);
            // ป้ายแดงบอกจำนวนใบที่รอจ่ายในแต่ละช่องทาง
            const badge =
              sub.href === "/finance/payments" ? companyCount
              : sub.href === "/finance/petty-cash" ? pettyCashCount
              : 0;
            return (
              <Link
                key={sub.href}
                href={sub.href}
                className={`flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs transition-colors ${
                  isActive
                    ? "bg-slate-700 font-semibold text-white"
                    : "text-slate-400 hover:bg-slate-800 hover:text-white"
                }`}
              >
                {sub.icon}
                <span className="flex-1">{sub.label}</span>
                {badge > 0 && (
                  <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                    {badge > 99 ? "99+" : badge}
                  </span>
                )}
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
  verifyCount = 0,
  role,
}: {
  pathname: string;
  approvalCount: number;
  editedCount: number;
  verifyCount?: number;
  role?: UserRole;
}) {
  const isFinance = role === "finance" || role === "admin";
  const isOnApprovals = pathname.startsWith("/approvals") || pathname.startsWith("/disbursement");
  const [open, setOpen] = useState(isOnApprovals);
  // ป้ายรวมบนหัวข้อ (ตอนหุบ) = รออนุมัติ + งานตรวจสอบ (ถ้าเป็นฝ่ายบัญชี)
  const headerBadge = approvalCount + (isFinance ? verifyCount : 0);

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
        {headerBadge > 0 && (
          <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1.5 text-[11px] font-bold text-white">
            {headerBadge > 99 ? "99+" : headerBadge}
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
            <span>รายการแก้ไข</span>
            {editedCount > 0 && (
              <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-500 px-1 text-[10px] font-bold text-white">
                {editedCount > 99 ? "99+" : editedCount}
              </span>
            )}
          </Link>

          {/* งานตรวจสอบ — เฉพาะฝ่ายบัญชี/การเงิน (ย้ายมาจาก "งานของฉัน") */}
          {isFinance && (
            <Link
              href="/disbursement"
              className={`flex items-center justify-between rounded-md px-2 py-1.5 text-xs transition-colors ${
                pathname.startsWith("/disbursement")
                  ? "bg-slate-700 font-semibold text-white"
                  : "text-slate-400 hover:bg-slate-800 hover:text-white"
              }`}
            >
              <span>งานตรวจสอบ</span>
              {verifyCount > 0 && (
                <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                  {verifyCount > 99 ? "99+" : verifyCount}
                </span>
              )}
            </Link>
          )}
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
  verifyCount?: number;
  companyCount?: number;
  pettyCashCount?: number;
  incompleteCount?: number;
  todoCount?: number;
  approverDepartment?: string | null;
  approverPositionIds?: string[];
}

export function Sidebar({ role, approvalCount = 0, editedCount = 0, verifyCount = 0, companyCount = 0, pettyCashCount = 0, incompleteCount = 0, todoCount = 0, approverDepartment = null, approverPositionIds = [] }: SidebarProps) {
  const pathname = usePathname() ?? "/";
  const isAdmin = role === "admin";

  // ป้ายแดงงานฝ่ายบัญชี (ตรวจสอบ / บริษัทสั่งจ่าย / เงินสดย่อย) อัปเดตเรียลไทม์ (เฉพาะ finance/admin)
  const financeCounts = useRealtimeFinanceCounts(
    verifyCount, companyCount, pettyCashCount,
    role === "finance" || role === "admin",
    "sidebar-finance-counts"
  );

  // ป้ายแดง "การอนุมัติ / รออนุมัติ" อัปเดตเรียลไทม์เมื่อมีใบส่งเข้ามา (ตามสิทธิ์ที่อนุมัติได้จริง)
  const liveApprovalCount = useRealtimeApprovalCount(
    approvalCount,
    { role: role ?? null, department: approverDepartment, positionIds: approverPositionIds },
    "sidebar-approval-count"
  );

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
        {/* คู่มือการใช้งาน — บนสุดของเมนู */}
        <Link
          href="/guide"
          className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
            pathname === "/guide"
              ? "bg-blue-600 text-white"
              : "text-slate-300 hover:bg-slate-800 hover:text-white"
          }`}
        >
          <BookOpen size={17} />
          คู่มือการใช้งาน
        </Link>

        <div className="my-2 border-t border-slate-800" />

        <p className="mb-1.5 px-3 text-[10px] font-semibold uppercase tracking-widest text-slate-500">
          จัดซื้อทั่วไป
        </p>

        {/* งานของฉัน */}
        <Suspense fallback={
          <button className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-slate-300">
            <FileText size={17} /><span>งานของฉัน</span>
          </button>
        }>
          <MyWorkDropdown pathname={pathname} role={role} incompleteCount={incompleteCount} todoCount={todoCount} />
        </Suspense>

        {/* การอนุมัติ */}
        <ApprovalsDropdown
          pathname={pathname}
          approvalCount={liveApprovalCount}
          editedCount={editedCount}
          verifyCount={financeCounts.verify}
          role={role}
        />

        {/* การเงิน — แสดงให้ finance และ admin */}
        {(role === "finance" || role === "admin") && (
          <>
            <div className="my-2 border-t border-slate-800" />
            <p className="mb-1.5 px-3 text-[10px] font-semibold uppercase tracking-widest text-slate-500">
              การเงิน
            </p>
            <FinanceDropdown pathname={pathname} companyCount={financeCounts.company} pettyCashCount={financeCounts.pettyCash} />
          </>
        )}
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
              pathname === "/settings/users"
                ? "bg-blue-600 text-white"
                : "text-slate-300 hover:bg-slate-800 hover:text-white"
            }`}
          >
            <Settings size={17} />
            จัดการผู้ใช้
          </Link>
          <Link
            href="/settings/positions"
            className={`mt-0.5 flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
              pathname.startsWith("/settings/positions")
                ? "bg-blue-600 text-white"
                : "text-slate-300 hover:bg-slate-800 hover:text-white"
            }`}
          >
            <Users size={17} />
            ตำแหน่งผู้ดูแล
          </Link>
        </div>
      )}
    </aside>
  );
}
