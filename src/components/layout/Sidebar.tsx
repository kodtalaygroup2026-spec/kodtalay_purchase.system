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
} from "lucide-react";
import { APP_NAME } from "@/lib/constants";

const NAV_ITEMS = [
  { href: "/", icon: LayoutDashboard, label: "หน้าหลัก" },
  { href: "/requisitions", icon: FileText, label: "ใบขอซื้อ (PR)" },
  { href: "/approvals", icon: CheckSquare, label: "การอนุมัติ" },
  { href: "/orders", icon: ShoppingCart, label: "ใบสั่งซื้อ (PO)" },
  { href: "/receipts", icon: Truck, label: "รับของ (GR)" },
  { href: "/suppliers", icon: Users, label: "ผู้ขาย" },
  { href: "/products", icon: Package, label: "สินค้า" },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden lg:flex lg:flex-col w-64 min-h-screen bg-slate-900 text-white shrink-0">
      <div className="px-6 py-5 border-b border-slate-700">
        <span className="font-bold text-sm text-white">{APP_NAME}</span>
      </div>
      <nav className="flex-1 px-3 py-4 space-y-1">
        {NAV_ITEMS.map((item) => {
          const isActive =
            item.href === "/"
              ? pathname === "/"
              : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                isActive
                  ? "bg-blue-600 text-white"
                  : "text-slate-300 hover:bg-slate-800 hover:text-white"
              }`}
            >
              <item.icon size={18} />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
