export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  PositionManagement,
  type Position,
  type PositionMember,
  type CategoryRef,
  type UserRef,
} from "@/components/settings/PositionManagement";

export default async function PositionsSettingsPage() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: currentProfile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (currentProfile?.role !== "admin") redirect("/");

  // ── ดึงตำแหน่ง + สมาชิก + หมวด + ผู้ใช้ ──────────────────────────────────────
  const [
    { data: positions },
    { data: members },
    { data: categories },
    { data: users },
  ] = await Promise.all([
    (supabase as any).from("approval_positions").select("id, name, description, is_active, created_at").order("created_at"),
    (supabase as any).from("position_members").select("id, position_id, user_id, profiles!user_id(full_name)"),
    (supabase as any).from("categories").select("id, code, name, mode, position_id, is_active").order("mode").order("sort_order"),
    (supabase as any).from("profiles").select("id, full_name, role").order("full_name"),
  ]);

  const memberList: PositionMember[] = (members ?? []).map((m: any) => ({
    id: m.id,
    position_id: m.position_id,
    user_id: m.user_id,
    user_name: m.profiles?.full_name ?? "—",
  }));

  const positionList: Position[] = (positions ?? []).map((p: any) => ({
    id: p.id,
    name: p.name,
    description: p.description ?? null,
    is_active: p.is_active ?? true,
  }));

  const categoryList: CategoryRef[] = (categories ?? []).map((c: any) => ({
    id: c.id,
    code: c.code ?? null,
    name: c.name,
    mode: c.mode ?? 1,
    position_id: c.position_id ?? null,
    is_active: c.is_active ?? true,
  }));

  const userList: UserRef[] = (users ?? []).map((u: any) => ({
    id: u.id,
    full_name: u.full_name ?? "—",
    role: u.role,
  }));

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-slate-800">ตำแหน่งผู้ดูแลงาน</h1>
        <p className="text-sm text-slate-500">
          กำหนดตำแหน่งที่ดูแลแต่ละหมวด และเพิ่ม/ลบคนในตำแหน่ง — คนในตำแหน่งจะจัดการงานของหมวดนั้นได้ (ไม่ต้องเปลี่ยน role หลัก)
        </p>
      </div>

      <PositionManagement
        initialPositions={positionList}
        initialMembers={memberList}
        categories={categoryList}
        users={userList}
      />
    </div>
  );
}
