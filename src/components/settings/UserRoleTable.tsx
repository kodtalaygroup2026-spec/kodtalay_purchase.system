"use client";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { ROLE_LABELS } from "@/lib/constants";
import { logAudit } from "@/lib/supabase/audit";
import { SortTh, useSortable } from "@/components/shared/SortTh";
import type { UserRole } from "@/types/database";

interface ProfileRow {
  id: string;
  full_name: string;
  email: string;
  department: string | null;
  role: UserRole;
  is_active: boolean;
  created_at: string;
}

interface UserRoleTableProps {
  profiles: ProfileRow[];
  currentUserId: string;
}

const ROLE_OPTIONS: UserRole[] = ["employee", "manager", "finance", "admin"];

export function UserRoleTable({ profiles, currentUserId }: UserRoleTableProps) {
  const supabase = createClient();
  const [loadingIds, setLoadingIds] = useState<Record<string, boolean>>({});
  const [savedIds, setSavedIds] = useState<Record<string, boolean>>({});
  const [roles, setRoles] = useState<Record<string, UserRole>>(
    Object.fromEntries(profiles.map((p) => [p.id, p.role]))
  );
  const { sorted, sortKey, sortDir, handleSort } = useSortable(profiles, "full_name");

  async function handleRoleChange(userId: string, newRole: UserRole) {
    const oldRole = profiles.find((p) => p.id === userId)?.role;
    setRoles((prev) => ({ ...prev, [userId]: newRole }));
    setLoadingIds((prev) => ({ ...prev, [userId]: true }));
    setSavedIds((prev) => ({ ...prev, [userId]: false }));

    const { error } = await supabase
      .from("profiles")
      .update({ role: newRole })
      .eq("id", userId);

    setLoadingIds((prev) => ({ ...prev, [userId]: false }));
    if (!error) {
      setSavedIds((prev) => ({ ...prev, [userId]: true }));
      logAudit({
        actorId: currentUserId,
        action: "user_role_changed",
        entity: "profiles",
        entityId: userId,
        metadata: { old_role: oldRole, new_role: newRole },
      });
      // ซ่อน indicator หลัง 2 วินาที
      setTimeout(() => setSavedIds((prev) => ({ ...prev, [userId]: false })), 2000);
    } else {
      // rollback ถ้า error
      const original = profiles.find((p) => p.id === userId)?.role;
      if (original) setRoles((prev) => ({ ...prev, [userId]: original }));
      alert("เกิดข้อผิดพลาด กรุณาลองใหม่");
    }
  }

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <table className="min-w-full text-sm">
        <thead className="border-b border-slate-100 bg-slate-50">
          <tr>
            <SortTh label="ชื่อ"   col="full_name"  activeCol={sortKey} dir={sortDir} onSort={handleSort} />
            <SortTh label="อีเมล"  col="email"      activeCol={sortKey} dir={sortDir} onSort={handleSort} />
            <SortTh label="แผนก"   col="department" activeCol={sortKey} dir={sortDir} onSort={handleSort} className="hidden md:table-cell" />
            <SortTh label="บทบาท" col="role"        activeCol={sortKey} dir={sortDir} onSort={handleSort} />
            <th className="px-4 py-3 w-20" />
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {sorted.map((profile) => {
            const isSelf = profile.id === currentUserId;
            const isLoading = loadingIds[profile.id];
            const isSaved = savedIds[profile.id];

            return (
              <tr key={profile.id} className="hover:bg-slate-50">
                <td className="px-4 py-3">
                  <p className="font-medium text-slate-800">
                    {profile.full_name || "—"}
                    {isSelf && (
                      <span className="ml-2 rounded-full bg-blue-100 px-2 py-0.5 text-xs text-blue-700">
                        คุณ
                      </span>
                    )}
                  </p>
                </td>
                <td className="px-4 py-3 text-slate-500">{profile.email}</td>
                <td className="px-4 py-3 text-slate-500 hidden md:table-cell">
                  {profile.department ?? "—"}
                </td>
                <td className="px-4 py-3">
                  <select
                    value={roles[profile.id]}
                    onChange={(e) => handleRoleChange(profile.id, e.target.value as UserRole)}
                    disabled={isLoading || isSelf}
                    title={isSelf ? "ไม่สามารถเปลี่ยน role ของตัวเองได้" : undefined}
                    className="rounded-md border border-slate-300 bg-white px-2 py-1 text-sm focus:border-blue-500 focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {ROLE_OPTIONS.map((r) => (
                      <option key={r} value={r}>
                        {ROLE_LABELS[r]}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-4 py-3 text-xs">
                  {isLoading && <span className="text-slate-400">กำลังบันทึก...</span>}
                  {isSaved && <span className="text-green-600 font-medium">✓ บันทึกแล้ว</span>}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {profiles.length === 0 && (
        <div className="py-12 text-center text-slate-400">ยังไม่มีผู้ใช้ในระบบ</div>
      )}
    </div>
  );
}
