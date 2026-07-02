export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { LineLinkButton } from "@/components/shared/LineLinkButton";
import { DepartmentSelector } from "@/components/profile/DepartmentSelector";
import { BankAccountSection } from "@/components/profile/BankAccountSection";
import { ROLE_LABELS } from "@/lib/constants";
import type { UserRole } from "@/types/database";

export default async function ProfilePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, email, role, department, line_user_id, bank_name, bank_account_number")
    .eq("id", user.id)
    .single();

  if (!profile) redirect("/login");

  const avatarUrl = user.user_metadata?.avatar_url as string | undefined;
  const initial = (profile.full_name || profile.email || "?").charAt(0).toUpperCase();

  return (
    <div className="mx-auto max-w-md space-y-4">
      <h1 className="text-lg font-bold text-slate-800">โปรไฟล์ของฉัน</h1>

      {/* ── Single card ── */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">

        {/* ── User info ── */}
        <div className="flex items-center gap-3 px-5 py-4">
          {avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={avatarUrl}
              alt={profile.full_name}
              referrerPolicy="no-referrer"
              className="h-11 w-11 rounded-full object-cover ring-2 ring-slate-100 shrink-0"
            />
          ) : (
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-blue-600 text-base font-bold text-white">
              {initial}
            </div>
          )}
          <div className="min-w-0">
            <p className="truncate font-semibold text-slate-800">{profile.full_name || "—"}</p>
            <p className="truncate text-xs text-slate-500">{profile.email}</p>
            <div className="mt-1 flex flex-wrap gap-1">
              <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[11px] font-medium text-blue-700">
                {ROLE_LABELS[profile.role as UserRole] ?? profile.role}
              </span>
              {profile.department && (
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600">
                  {profile.department}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* ── แผนก ── */}
        <div className="border-t border-slate-100 px-5 py-4">
          <DepartmentSelector userId={user.id} initialDepartment={profile.department ?? null} compact />
        </div>

        {/* ── บัญชีธนาคาร ── */}
        <div className="border-t border-slate-100 px-5 py-4">
          <BankAccountSection
            userId={user.id}
            initialBankName={(profile as any).bank_name ?? null}
            initialBankAccount={(profile as any).bank_account_number ?? null}
          />
        </div>

        {/* ── LINE ── */}
        <div className="border-t border-slate-100 px-5 py-4">
          <LineLinkButton userId={user.id} initialLineUserId={profile.line_user_id} compact />
        </div>

      </div>
    </div>
  );
}
