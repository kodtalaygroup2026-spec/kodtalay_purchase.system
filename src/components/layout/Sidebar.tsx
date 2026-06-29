"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
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
} from "lucide-react";
import { APP_NAME } from "@/lib/constants";
import type { UserRole } from "@/types/database";

interface NavItem {
  href: string;
  icon: React.ElementType;
  label: string;
}

const PROCUREMENT_NAV: NavItem[] = [
  { href: "/requisitions", icon: FileText, label: "งานของฉัน" },
  { href: "/orders", icon: ShoppingCart, label: "ใบสั่งซื้อ (PO)" },
  { href: "/approvals", icon: CheckSquare, label: "การอนุมัติ" },
  { href: "/suppliers", icon: Users, label: "ผู้ขาย" },
  { href: "/products", icon: Package, label: "สินค้า" },
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

type Section = "home" | "procurement" | "construction" | "finance" | "settings";

function detectSection(pathname: string | null): Section {
  if (!pathname) return "home";
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

        {/* จัดซื้อทั่วไป — แสดงเฉพาะเมื่ออยู่ในหน้าจัดซื้อ */}
        {section === "procurement" && (
          <NavGroup label="จัดซื้อทั่วไป" items={PROCUREMENT_NAV} />
        )}

        {/* ก่อสร้าง — แสดงเฉพาะเมื่ออยู่ในหน้าก่อสร้าง */}
        {section === "construction" && (
          <NavGroup label="ก่อสร้าง" items={CONSTRUCTION_NAV} />
        )}

        {/* การเงิน — แสดงเฉพาะ role finance และ admin */}
        {isFinanceUser && (
          <NavGroup label="การเงิน" items={FINANCE_NAV} />
        )}
      </nav>

      {/* Admin section */}
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
