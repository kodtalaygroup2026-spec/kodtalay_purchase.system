"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  FileText,
  ShoppingCart,
  CheckSquare,
  HardHat,
  Receipt,
  Banknote,
  PiggyBank,
} from "lucide-react";
import type { UserRole } from "@/types/database";

interface NavItem {
  href: string;
  icon: React.ElementType;
  label: string;
}

const PROCUREMENT_MOBILE: NavItem[] = [
  { href: "/", icon: LayoutDashboard, label: "หลัก" },
  { href: "/requisitions", icon: FileText, label: "งานของฉัน" },
  { href: "/orders", icon: ShoppingCart, label: "PO" },
  { href: "/approvals", icon: CheckSquare, label: "อนุมัติ" },
];

const CONSTRUCTION_MOBILE: NavItem[] = [
  { href: "/", icon: LayoutDashboard, label: "หลัก" },
  { href: "/construction", icon: HardHat, label: "งาน" },
  { href: "/construction/payments", icon: Receipt, label: "ขอเบิก" },
];

const FINANCE_MOBILE: NavItem[] = [
  { href: "/", icon: LayoutDashboard, label: "หลัก" },
  { href: "/finance", icon: Banknote, label: "จ่ายเงิน" },
  { href: "/finance/petty-cash", icon: PiggyBank, label: "เงินสดย่อย" },
  { href: "/finance/tax-invoices", icon: FileText, label: "ใบกำกับ" },
];

const HOME_MOBILE: NavItem[] = [
  { href: "/", icon: LayoutDashboard, label: "หลัก" },
];

interface MobileNavProps {
  role?: UserRole;
}

export function MobileNav({ role }: MobileNavProps) {
  const rawPathname = usePathname();
  const pathname = rawPathname ?? "/";
  const isFinanceUser = role === "finance" || role === "admin";

  let navItems: NavItem[];
  if (!pathname || pathname === "/") {
    navItems = HOME_MOBILE;
  } else if (pathname.startsWith("/construction")) {
    navItems = CONSTRUCTION_MOBILE;
  } else if (pathname.startsWith("/finance")) {
    navItems = isFinanceUser ? FINANCE_MOBILE : HOME_MOBILE;
  } else {
    navItems = PROCUREMENT_MOBILE;
  }

  function isActive(href: string) {
    if (href === "/") return pathname === "/";
    if (href === "/construction") {
      return pathname === "/construction" || (pathname.startsWith("/construction/") && !pathname.startsWith("/construction/payments"));
    }
    if (href === "/finance") {
      return pathname === "/finance" || (pathname.startsWith("/finance/") && !pathname.startsWith("/finance/petty-cash") && !pathname.startsWith("/finance/tax-invoices"));
    }
    return pathname.startsWith(href);
  }

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-20 flex lg:hidden border-t border-slate-200 bg-white">
      {navItems.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className={`flex flex-1 flex-col items-center gap-1 py-2 text-xs transition-colors ${
            isActive(item.href) ? "text-blue-600" : "text-slate-500 hover:text-slate-800"
          }`}
        >
          <item.icon size={20} />
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
