"use client";
import { useState, Suspense } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import {
  LayoutDashboard,
  FileText,
  ShoppingCart,
  CheckSquare,
  Users,
  Package,
  Settings,
  HardHat,
  Banknote,
  PiggyBank,
  Receipt,
  ChevronDown,
  ChevronRight,
  Plus,
} from "lucide-react";
import { APP_NAME } from "@/lib/constants";
import type { UserRole } from "@/types/database";

interface NavItem {
  href: string;
  icon: React.ElementType;
  label: string;
}

const PROCUREMENT_NAV: NavItem[] = [
  { href: "/orders", icon: ShoppingCart, label: "ใบสั่งซื้อ (PO)" },
  { href: "/approvals", icon: CheckSquare, label: "การอนุมัติ" },
  { href: "/suppliers", icon: Users, label: "ผู้ขาย" },
  { href: "/products", icon: Package, label: "สินค้า" },
];

const MY_WORK_SUB = [
  { href: "/requisitions",        step: null, label: "ทั้งหมด" },
  { href: "/requisitions?step=0", step: "0",  label: "ร่าง / ตีกลับ" },
  { href: "/requisitions?step=1", step: "1",  label: "รออนุมัติ" },
  { href: "/requisitions?step=2", step: "2",  label: "รอสร้าง PO" },
  { href: "/requisitions?step=3", step: "3",  label: "มี PO" },
  { href: "/requisitions/new",    step: null, label: "+ สร้าง PR" },
];

const CONSTRUCTION_NAV: NavItem[] = [
  { href: "/construction", icon: HardHat, label: "งานก่อสร้าง" },
  { href: "/construction/payments", icon: Receipt, label: "ขอเบิก / ตรวจรับ" },
];

const FINANCE_NAV: NavItem[] = [
  { href: "/finance", icon: Banknote, label: "จ่ายเงิน" },
  { href: "/finance/petty-cash", icon: PiggyBank, label: "เงินสดย่อย" },
  { href: "/finance/tax-invoices", icon: FileText, label: "ใบกำกับภาษี" },
];

const ALL_HREFS = [
  "/",
  ...PROCUREMENT_NAV.map((i) => i.href),
  ...CONSTRUCTION_NAV.map((i) => i.href),
  ...FINANCE_NAV.map((i) => i.href),
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

type Section = "home" | "procurement" | "construction" | "finance" | "settings";

function detectSection(pathname: string): Section {
  if (pathname.startsWith("/construction")) return "construction";
  if (pathname.startsWith("/finance")) return "finance";
  if (pathname.startsWith("/settings")) return "settings";
  if (pathname === "/") return "home";
  return "procurement";
}

interface SidebarProps {
  role?: UserRole;
}

export function Sidebar({ role }: SidebarProps) {
  const pathname = usePathname() ?? "/";
  const section = detectSection(pathname);
  const isFinanceUser = role === "finance" || role === "admin";
  const isAdmin = role === "admin";

  function isActive(href: string) {
    if (pathname === href) return true;
    if (href === "/") return false;
    if (!pathname.startsWith(href + "/")) return false;
    const hasMoreSpecificMatch = ALL_HREFS.some(
      (h) => h !== href && h.startsWith(href + "/") && pathname.startsWith(h),
    );
    return !hasMoreSpecificMatch;
  }

  function NavLink({ href, icon: Icon, label }: NavItem) {
    return (
      <Link
        href={href}
        className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
          isActive(href)
            ? "bg-blue-600 text-white"
            : "text-slate-300 hover:bg-slate-800 hover:text-white"
        }`}
      >
        <Icon size={17} />
        {label}
      </Link>
    );
  }

  function NavGroup({ label, items }: { label: string; items: NavItem[] }) {
    return (
      <div>
        <p className="mb-1.5 px-3 text-[10px] font-semibold uppercase tracking-widest text-slate-500">
          {label}
        </p>
        <div className="space-y-0.5">
          {items.map((item) => (
            <NavLink key={item.href} {...item} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <aside className="hidden lg:flex lg:flex-col w-64 min-h-screen bg-slate-900 text-white shrink-0">
      {/* Logo */}
      <Link
        href="/"
        className="px-6 py-5 border-b border-slate-700 hover:bg-slate-800 transition-colors"
      >
        <span className="font-bold text-sm text-white">{APP_NAME}</span>
      </Link>

      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-5">
        {/* หน้าหลัก */}
        <NavLink href="/" icon={LayoutDashboard} label="หน้าหลัก" />

        {/* จัดซื้อทั่วไป */}
        {section === "procurement" && (
          <div>
            <p className="mb-1.5 px-3 text-[10px] font-semibold uppercase tracking-widest text-slate-500">
              จัดซื้อทั่วไป
            </p>
            <div className="space-y-0.5">
              <Suspense fallback={
                <button className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-slate-300">
                  <FileText size={17} /><span>งานของฉัน</span>
                </button>
              }>
                <MyWorkDropdown pathname={pathname} />
              </Suspense>
              {PROCUREMENT_NAV.map((item) => (
                <NavLink key={item.href} {...item} />
              ))}
            </div>
          </div>
        )}

        {/* ก่อสร้าง */}
        {section === "construction" && (
          <NavGroup label="ก่อสร้าง" items={CONSTRUCTION_NAV} />
        )}

        {/* การเงิน */}
        {isFinanceUser && (
          <NavGroup label="การเงิน" items={FINANCE_NAV} />
        )}
      </nav>

      {/* Admin */}
      {isAdmin && (
        <div className="px-3 py-3 border-t border-slate-700">
          <p className="mb-1.5 px-3 text-[10px] font-semibold uppercase tracking-widest text-slate-500">
            จัดการระบบ
          </p>
          <NavLink href="/settings/users" icon={Settings} label="จัดการผู้ใช้" />
        </div>
      )}
    </aside>
  );
}
