"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  FileText,
  ShoppingCart,
  CheckSquare,
  Truck,
} from "lucide-react";

const MOBILE_NAV = [
  { href: "/", icon: LayoutDashboard, label: "หลัก" },
  { href: "/requisitions", icon: FileText, label: "PR" },
  { href: "/approvals", icon: CheckSquare, label: "อนุมัติ" },
  { href: "/orders", icon: ShoppingCart, label: "PO" },
  { href: "/receipts", icon: Truck, label: "รับของ" },
];

export function MobileNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-20 flex lg:hidden border-t border-slate-200 bg-white">
      {MOBILE_NAV.map((item) => {
        const isActive =
          item.href === "/"
            ? pathname === "/"
            : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`flex flex-1 flex-col items-center gap-1 py-2 text-xs transition-colors ${
              isActive ? "text-blue-600" : "text-slate-500 hover:text-slate-800"
            }`}
          >
            <item.icon size={20} />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
