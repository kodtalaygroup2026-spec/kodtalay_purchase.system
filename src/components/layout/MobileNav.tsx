"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { FileText, CheckSquare } from "lucide-react";

export function MobileNav() {
  const pathname = usePathname() ?? "/";

  const items = [
    { href: "/requisitions", icon: FileText,    label: "งานของฉัน" },
    { href: "/approvals",    icon: CheckSquare, label: "การอนุมัติ" },
  ];

  function isActive(href: string) {
    return pathname.startsWith(href);
  }

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-20 flex lg:hidden border-t border-slate-200 bg-white">
      {items.map((item) => (
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
