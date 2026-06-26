"use client";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { ROLE_LABELS } from "@/lib/constants";
import { LineLinkButton } from "@/components/shared/LineLinkButton";
import type { Profile } from "@/types/database";

interface NavbarProps {
  profile: Pick<Profile, "full_name" | "email" | "role">;
  avatarUrl?: string;
  isLineLinked?: boolean;
}

export function Navbar({ profile, avatarUrl, isLineLinked = false }: NavbarProps) {
  const router = useRouter();
  const supabase = createClient();

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  // ตัวอักษรย่อสำหรับ fallback กรณีไม่มีรูป
  const initials = (profile.full_name || profile.email)
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <header className="sticky top-0 z-10 flex h-14 items-center justify-between border-b border-slate-200 bg-white px-4 lg:px-6">
      <span className="font-semibold text-sm text-slate-800 lg:hidden">
        ระบบจัดซื้อ Kodtalay
      </span>
      <div className="flex-1" />
      <div className="flex items-center gap-2">
        {/* LINE link status */}
        <div className="hidden sm:block">
          <LineLinkButton isLinked={isLineLinked} />
        </div>

        {/* รูปโปรไฟล์ — แสดงทุก breakpoint รวมมือถือ */}
        {avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={avatarUrl}
            alt={profile.full_name || profile.email}
            referrerPolicy="no-referrer"
            className="h-8 w-8 rounded-full object-cover ring-2 ring-slate-200"
          />
        ) : (
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white ring-2 ring-slate-200">
            {initials}
          </div>
        )}

        {/* ชื่อและบทบาท — ซ่อนบนมือถือ */}
        <div className="hidden flex-col text-right sm:flex">
          <p className="text-sm font-medium text-slate-800 leading-tight">
            {profile.full_name || profile.email}
          </p>
          <p className="text-xs text-slate-500">{ROLE_LABELS[profile.role]}</p>
        </div>

        {/* ปุ่ม logout */}
        <button
          onClick={handleLogout}
          className="flex items-center gap-1 rounded-md px-2 py-1.5 text-sm text-slate-600 transition-colors hover:bg-red-50 hover:text-red-600 sm:px-3"
        >
          <LogOut size={16} />
          <span className="hidden sm:inline">ออกจากระบบ</span>
        </button>
      </div>
    </header>
  );
}
