// ===========================================================================
// File: src/lib/line/resolveRecipients.ts
// คำอธิบาย: หาว่าใบขอซื้อหนึ่งใบต้องแจ้งเตือนใครบ้าง แล้วคืน line_user_id
//           ใช้ service role เพราะต้องอ่าน profiles ข้ามแผนก/สาขา
//           (เรียกได้จากฝั่งเซิร์ฟเวอร์เท่านั้น)
// ===========================================================================

import { createClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";

const adminClient = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

export interface PrSummary {
  id: string;
  pr_number: string;
  title: string;
  total_amount: number;
  requester_id: string;
  requester_name: string;
  requester_department: string | null;
  category_id: string | null;
}

/** อ่านข้อมูลใบขอซื้อที่จำเป็นต่อการประกอบข้อความแจ้งเตือน */
export async function getPrSummary(prId: string): Promise<PrSummary | null> {
  const { data: pr, error } = await adminClient
    .from("purchase_requisitions")
    .select("id, pr_number, title, total_amount, requester_id")
    .eq("id", prId)
    .maybeSingle();

  if (error || !pr) return null;

  const { data: requester } = await adminClient
    .from("profiles")
    .select("full_name, department")
    .eq("id", pr.requester_id)
    .maybeSingle();

  return {
    id: pr.id,
    pr_number: pr.pr_number,
    title: pr.title,
    total_amount: Number(pr.total_amount ?? 0),
    requester_id: pr.requester_id,
    requester_name: requester?.full_name ?? "—",
    requester_department: requester?.department ?? null,
    category_id: await readCategoryId(prId),
  };
}

/**
 * อ่าน category_id แยกออกมาต่างหาก เพราะคอลัมน์นี้เพิ่มมาใน migration 0036
 * ถ้าฐานข้อมูลยังไม่ได้ apply จะได้ null แทนที่จะพังทั้งการแจ้งเตือน
 */
async function readCategoryId(prId: string): Promise<string | null> {
  const { data, error } = await adminClient
    .from("purchase_requisitions")
    .select("category_id")
    .eq("id", prId)
    .maybeSingle();

  if (error || !data) return null;
  return (data as { category_id: string | null }).category_id ?? null;
}

/** แปลง user id เป็น line_user_id เฉพาะคนที่ผูก LINE ไว้แล้ว */
async function toLineUserIds(userIds: string[]): Promise<string[]> {
  if (userIds.length === 0) return [];

  const { data } = await adminClient
    .from("profiles")
    .select("line_user_id")
    .in("id", userIds)
    .not("line_user_id", "is", null);

  return (data ?? []).map((p) => p.line_user_id as string).filter(Boolean);
}

/** ฝ่ายบัญชี (บช.) ที่ยังใช้งานอยู่ */
async function financeUserIds(): Promise<string[]> {
  const { data } = await adminClient
    .from("profiles")
    .select("id")
    .eq("role", "finance")
    .eq("is_active", true);

  return (data ?? []).map((p) => p.id as string);
}

/**
 * ผู้อนุมัติของใบขอซื้อ = หัวหน้าแผนกของผู้ขอ
 *                        + สมาชิกตำแหน่งที่ผูกกับหมวดของใบนั้น
 *                        + ฝ่ายบัญชี (อนุมัติได้ทุกใบ)
 * ตรรกะเดียวกับกล่องพรีวิว "ผู้อนุมัติ" ในหน้าสร้าง PR
 */
export async function resolveApproverLineIds(pr: PrSummary): Promise<string[]> {
  const userIds = new Set<string>();

  // 1) หัวหน้าแผนกเดียวกับผู้ขอ
  if (pr.requester_department) {
    const { data: heads } = await adminClient
      .from("profiles")
      .select("id")
      .eq("department", pr.requester_department)
      .in("role", ["manager", "admin"])
      .eq("is_active", true);
    for (const head of heads ?? []) userIds.add(head.id as string);
  }

  // 2) สมาชิกของตำแหน่งที่ผูกกับหมวดของใบนี้
  if (pr.category_id) {
    const { data: category } = await adminClient
      .from("categories")
      .select("position_id")
      .eq("id", pr.category_id)
      .maybeSingle();

    const positionId = (category as { position_id: string | null } | null)?.position_id ?? null;
    if (positionId) {
      const { data: members } = await adminClient
        .from("position_members")
        .select("user_id")
        .eq("position_id", positionId);
      for (const member of members ?? []) userIds.add(member.user_id as string);
    }
  }

  // 3) ฝ่ายบัญชี
  for (const id of await financeUserIds()) userIds.add(id);

  // ไม่ต้องแจ้งผู้ขอเอง
  userIds.delete(pr.requester_id);

  return toLineUserIds([...userIds]);
}

/** ฝ่ายบัญชีทั้งหมด (ใช้แจ้งงานเข้าคิวตรวจสอบ / รอจ่าย) — ข้ามคนที่เป็นผู้ลงมือเอง */
export async function resolveFinanceLineIds(excludeUserId?: string | null): Promise<string[]> {
  const userIds = new Set(await financeUserIds());
  if (excludeUserId) userIds.delete(excludeUserId);
  return toLineUserIds([...userIds]);
}
