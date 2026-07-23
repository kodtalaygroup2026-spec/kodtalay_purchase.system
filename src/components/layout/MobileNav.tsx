"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  FileText, CheckSquare, Plus, Banknote, Menu, X,
  AlertTriangle, ClipboardCheck, PiggyBank, FileCheck2,
  Users, Settings, User as UserIcon, Building2, ListFilter, BookOpen,
} from "lucide-react";
import { useRealtimeFinanceCounts } from "@/hooks/useRealtimeFinanceCounts";
import { useRealtimeApprovalCount } from "@/hooks/useRealtimeApprovalCount";
import type { UserRole } from "@/types/database";

interface MobileNavProps {
  role?: UserRole;
  approvalCount?: number;
  verifyCount?: number;
  companyCount?: number;
  pettyCashCount?: number;
  fixedReviewCount?: number;
  incompleteCount?: number;
  todoCount?: number;
  approverDepartment?: string | null;
  approverPositionIds?: string[];
}

interface DrawerLink {
  href: string;
  label: string;
  icon: React.ElementType;
  badge?: number;
  badgeColor?: string;
}

export function MobileNav({
  role,
  approvalCount = 0,
  verifyCount = 0,
  companyCount = 0,
  pettyCashCount = 0,
  fixedReviewCount = 0,
  incompleteCount = 0,
  todoCount = 0,
  approverDepartment = null,
  approverPositionIds = [],
}: MobileNavProps) {
  const pathname = usePathname() ?? "/";
  // render = อยู่ใน DOM (คงไว้ระหว่างสไลด์ลงตอนปิด) · show = สถานะเปิด (คุมทรานซิชัน)
  const [render, setRender] = useState(false);
  const [show, setShow] = useState(false);

  // พอ mount แล้วค่อยพลิก show เป็น true ในเฟรมถัดไป เพื่อให้สไลด์ขึ้นจากด้านล่าง
  useEffect(() => {
    if (!render) return;
    const id = requestAnimationFrame(() => setShow(true));
    return () => cancelAnimationFrame(id);
  }, [render]);

  function openSheet() {
    setRender(true);
  }
  function closeSheet() {
    setShow(false);
    // ถอดออกจาก DOM หลังทรานซิชันจบ (ตรงกับ duration-300)
    window.setTimeout(() => setRender(false), 300);
  }

  // ป้ายแดงงานฝ่ายบัญชี (ตรวจสอบ / บริษัทสั่งจ่าย / เงินสดย่อย) อัปเดตเรียลไทม์ (เฉพาะ finance/admin)
  const financeCounts = useRealtimeFinanceCounts(
    verifyCount, companyCount, pettyCashCount, fixedReviewCount,
    role === "finance" || role === "admin",
    "mobilenav-finance-counts"
  );
  const liveVerifyCount = financeCounts.verify;

  // ป้ายแดง "อนุมัติ" อัปเดตเรียลไทม์ตามสิทธิ์ที่อนุมัติได้จริง
  const liveApprovalCount = useRealtimeApprovalCount(
    approvalCount,
    { role: role ?? null, department: approverDepartment, positionIds: approverPositionIds },
    "mobilenav-approval-count"
  );

  if (pathname === "/") return null;

  const isFinance = role === "finance" || role === "admin";
  const isAdmin = role === "admin";

  // ── ปุ่มบนแถบล่าง (ซ้าย 2 / FAB / ขวา 2) ────────────────────────────────
  const leftItems = [
    { href: "/requisitions", label: "งานของฉัน", icon: FileText,    badge: todoCount,     color: "bg-red-500" },
    { href: "/approvals",    label: "อนุมัติ",    icon: CheckSquare, badge: liveApprovalCount, color: "bg-red-500"  },
  ];
  const rightItem = isFinance
    ? { href: "/finance", label: "การเงิน", icon: Banknote, badge: liveVerifyCount, color: "bg-red-500" }
    : { href: "/requisitions/incomplete", label: "เอกสารค้าง", icon: AlertTriangle, badge: incompleteCount, color: "bg-amber-500" };

  function isActive(href: string) {
    if (href === "/requisitions") return pathname === "/requisitions";
    return pathname.startsWith(href);
  }

  // ── เมนูเต็มใน drawer ────────────────────────────────────────────────────
  const myWork: DrawerLink[] = [
    { href: "/requisitions?step=1", label: "งานอนุมัติ", icon: CheckSquare },
    { href: "/requisitions", label: "งานเอกสาร", icon: FileText, badge: todoCount, badgeColor: "bg-red-500" },
    { href: "/requisitions/incomplete", label: "งานเอกสารไม่สมบูรณ์", icon: AlertTriangle, badge: incompleteCount, badgeColor: "bg-amber-500" },
    { href: "/requisitions/new", label: "สร้าง PR", icon: Plus },
  ];

  const approvals: DrawerLink[] = [
    { href: "/approvals", label: "รออนุมัติ", icon: CheckSquare, badge: liveApprovalCount, badgeColor: "bg-red-500" },
    { href: "/approvals/edited-items", label: "รายการแก้ไข", icon: FileText },
    ...(isFinance ? [{ href: "/disbursement", label: "งานตรวจสอบ", icon: ClipboardCheck, badge: liveVerifyCount, badgeColor: "bg-red-500" }] : []),
  ];

  const finance: DrawerLink[] = isFinance
    ? [
        { href: "/finance", label: "รายการทั้งหมด", icon: ListFilter },
        { href: "/finance/payments", label: "รายการบริษัทสั่งจ่าย", icon: Building2, badge: financeCounts.company, badgeColor: "bg-red-500" },
        { href: "/finance/petty-cash", label: "รายการเงินสดย่อย", icon: PiggyBank, badge: financeCounts.pettyCash, badgeColor: "bg-red-500" },
        { href: "/finance/documents", label: "งานเอกสารสมบูรณ์", icon: FileCheck2, badge: financeCounts.fixedReview, badgeColor: "bg-red-500" },
      ]
    : [];

  const admin: DrawerLink[] = isAdmin
    ? [
        { href: "/settings/users", label: "จัดการผู้ใช้", icon: Settings },
        { href: "/settings/positions", label: "ตำแหน่งผู้ดูแล", icon: Users },
      ]
    : [];

  return (
    <>
      {/* ── แถบล่าง ─────────────────────────────────────────────────────── */}
      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 backdrop-blur lg:hidden">
        <div className="flex items-stretch justify-around pb-[env(safe-area-inset-bottom)]">
          {leftItems.map((item) => (
            <BarItem key={item.href} {...item} active={isActive(item.href)} />
          ))}

          {/* ปุ่มลอย สร้าง PR */}
          <Link
            href="/requisitions/new"
            className="relative -mt-5 flex w-16 shrink-0 flex-col items-center"
            aria-label="สร้าง PR"
          >
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-600 text-white shadow-lg ring-4 ring-white transition active:scale-95">
              <Plus size={24} />
            </span>
            <span className="mt-0.5 text-[10px] font-medium text-blue-600">สร้าง PR</span>
          </Link>

          <BarItem {...rightItem} active={isActive(rightItem.href)} />

          {/* ปุ่มเมนู */}
          <button
            onClick={openSheet}
            className="flex flex-1 flex-col items-center gap-0.5 py-2 text-slate-500 transition active:text-slate-800"
          >
            <Menu size={20} />
            <span className="text-[10px]">เมนู</span>
          </button>
        </div>
      </nav>

      {/* ── Bottom sheet: เมนูเต็ม (สไลด์ขึ้น/ลงนุ่ม ๆ) ──────────────────── */}
      {render && (
        <div className="fixed inset-0 z-40 lg:hidden" onClick={closeSheet}>
          {/* ฉากหลังจาง — fade เข้า/ออก */}
          <div
            className={`absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity duration-300 motion-reduce:transition-none ${
              show ? "opacity-100" : "opacity-0"
            }`}
          />

          {/* แผ่นเมนู — สไลด์ขึ้นจากด้านล่าง */}
          <div
            className={`absolute inset-x-0 bottom-0 max-h-[85vh] overflow-y-auto rounded-t-2xl bg-white pb-[env(safe-area-inset-bottom)] shadow-2xl transition-transform duration-300 ease-out motion-reduce:transition-none ${
              show ? "translate-y-0" : "translate-y-full"
            }`}
            onClick={(e) => e.stopPropagation()}
          >
            {/* handle + header */}
            <div className="sticky top-0 z-10 rounded-t-2xl bg-white px-5 pb-2 pt-3">
              <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-slate-200" />
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold text-slate-800">เมนูทั้งหมด</h2>
                <button onClick={closeSheet} className="rounded-lg p-1.5 text-slate-400 active:bg-slate-100">
                  <X size={18} />
                </button>
              </div>
            </div>

            <div className="space-y-5 px-5 pb-6">
              <DrawerSection title="งานของฉัน" links={myWork} pathname={pathname} onNavigate={closeSheet} />
              <DrawerSection title="การอนุมัติ" links={approvals} pathname={pathname} onNavigate={closeSheet} />
              {finance.length > 0 && (
                <DrawerSection title="การเงิน" links={finance} pathname={pathname} onNavigate={closeSheet} />
              )}
              {admin.length > 0 && (
                <DrawerSection title="จัดการระบบ" links={admin} pathname={pathname} onNavigate={closeSheet} />
              )}
              <DrawerSection
                title="บัญชีผู้ใช้"
                links={[
                  { href: "/profile", label: "โปรไฟล์ของฉัน", icon: UserIcon },
                  { href: "/guide", label: "คู่มือการใช้งาน", icon: BookOpen },
                ]}
                pathname={pathname}
                onNavigate={closeSheet}
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ── ปุ่มบนแถบล่าง ───────────────────────────────────────────────────────────
function BarItem({
  href, label, icon: Icon, badge = 0, color = "bg-red-500", active,
}: {
  href: string; label: string; icon: React.ElementType; badge?: number; color?: string; active: boolean;
}) {
  return (
    <Link
      href={href}
      className={`relative flex flex-1 flex-col items-center gap-0.5 py-2 transition ${
        active ? "text-blue-600" : "text-slate-500 active:text-slate-800"
      }`}
    >
      <span className="relative">
        <Icon size={20} />
        {badge > 0 && (
          <span className={`absolute -right-2 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[9px] font-bold text-white ${color}`}>
            {badge > 99 ? "99+" : badge}
          </span>
        )}
      </span>
      <span className="text-[10px]">{label}</span>
    </Link>
  );
}

// ── หมวดในเมนูเต็ม ──────────────────────────────────────────────────────────
function DrawerSection({
  title, links, pathname, onNavigate,
}: {
  title: string; links: DrawerLink[]; pathname: string; onNavigate: () => void;
}) {
  if (links.length === 0) return null;
  return (
    <div>
      <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-slate-400">{title}</p>
      <div className="space-y-0.5">
        {links.map((l) => {
          const active = l.href.includes("?") ? false : pathname === l.href;
          return (
            <Link
              key={l.href}
              href={l.href}
              onClick={onNavigate}
              className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition ${
                active ? "bg-blue-50 font-semibold text-blue-700" : "text-slate-700 active:bg-slate-100"
              }`}
            >
              <l.icon size={17} className={active ? "text-blue-600" : "text-slate-400"} />
              <span className="flex-1">{l.label}</span>
              {(l.badge ?? 0) > 0 && (
                <span className={`flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[10px] font-bold text-white ${l.badgeColor ?? "bg-red-500"}`}>
                  {(l.badge ?? 0) > 99 ? "99+" : l.badge}
                </span>
              )}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
