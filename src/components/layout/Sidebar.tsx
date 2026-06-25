"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  FileText,
  ShoppingCart,
  CheckSquare,
  Truck,
  Users,
  Package,
  Settings,
  Receipt,
  GitBranch,
} from "lucide-react";
import { APP_NAME } from "@/lib/constants";
import type { UserRole } from "@/types/database";

const NAV_ITEMS = [
  { href: "/", icon: LayoutDashboard, label: "หน้าหลัก" },
  { href: "/expenses", icon: Receipt, label: "ใบเบิก" },
  { href: "/requisitions", icon: FileText, label: "ใบขอซื้อ (PR)" },
  { href: "/approvals", icon: CheckSquare, label: "การอนุมัติ" },
  { href: "/orders", icon: ShoppingCart, label: "ใบสั่งซื้อ (PO)" },
  { href: "/receipts", icon: Truck, label: "รับของ (GR)" },
  { href: "/suppliers", icon: Users, label: "ผู้ขาย" },
  { href: "/products", icon: Package, label: "สินค้า" },
];

interface SidebarProps {
  role?: UserRole;
}

export function Sidebar({ role }: SidebarProps) {
  const pathname = usePathname();

  function navLink(href: string, icon: React.ElementType, label: string) {
    const Icon = icon;
    const isActive =
      href === "/" ? pathname === "/" : pathname.startsWith(href);
    return (
      <Link
        key={href}
        href={href}
        className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
          isActive
            ? "bg-blue-600 text-white"
            : "text-slate-300 hover:bg-slate-800 hover:text-white"
        }`}
      >
        <Icon size={18} />
        {label}
      </Link>
    );
  }

  return (
    <aside className="hidden lg:flex lg:flex-col w-64 min-h-screen bg-slate-900 text-white shrink-0">
      <div className="px-6 py-5 border-b border-slate-700">
        <span className="font-bold text-sm text-white">{APP_NAME}</span>
      </div>
      <nav className="flex-1 px-3 py-4 space-y-1">
        {NAV_ITEMS.map((item) => navLink(item.href, item.icon, item.label))}
      </nav>

      {/* Admin-only section */}
      {role === "admin" && (
        <div className="px-3 py-3 border-t border-slate-700">
          <p className="px-3 mb-1 text-xs font-semibold uppercase tracking-wider text-slate-500">
            จัดการระบบ
          </p>
          {navLink("/settings/users", Settings, "จัดการผู้ใช้")}
          {navLink("/settings/branches", GitBranch, "จัดการสาขา")}
        </div>
      )}
    </aside>
  );
}
