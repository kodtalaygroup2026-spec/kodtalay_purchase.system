export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { LineLinkButton } from "@/components/shared/LineLinkButton";
import { DepartmentSelector } from "@/components/profile/DepartmentSelector";
import { ROLE_LABELS } from "@/lib/constants";
import type { UserRole } from "@/types/database";

export default async function ProfilePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, email, role, department, line_user_id")
    .eq("id", user.id)
    .single();

  if (!profile) redirect("/login");

  const avatarUrl = user.user_metadata?.avatar_url as string | undefined;

  return (
    <div className="mx-auto max-w-lg space-y-5">
      <h1 className="text-xl font-bold text-slate-800">โปรไฟล์ของฉัน</h1>

      {/* ข้อมูลผู้ใช้ */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center gap-4">
          {avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={avatarUrl}
              alt={profile.full_name}
              referrerPolicy="no-referrer"
              className="h-14 w-14 rounded-full object-cover ring-2 ring-slate-200"
            />
          ) : (
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-blue-600 text-lg font-bold text-white">
              {(profile.full_name || profile.email).charAt(0).toUpperCase()}
            </div>
          )}
          <div>
            <p className="font-semibold text-slate-800">{profile.full_name || "—"}</p>
            <p className="text-sm text-slate-500">{profile.email}</p>
            <span className="mt-1 inline-block rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
              {ROLE_LABELS[profile.role as UserRole] ?? profile.role}
            </span>
            {profile.department && (
              <span className="ml-2 mt-1 inline-block rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                {profile.department}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* เลือกแผนก */}
      <DepartmentSelector
        userId={user.id}
        initialDepartment={profile.department ?? null}
      />

      {/* LINE Linking */}
      <LineLinkButton userId={user.id} initialLineUserId={profile.line_user_id} />
    </div>
  );
}
