// ===========================================================================
// File: src/lib/supabase/admin.ts
// คำอธิบาย: Supabase client ที่ใช้ Service Role key — ข้าม RLS ทั้งหมด
// คำเตือนด้านความปลอดภัย: ใช้ฝั่ง server เท่านั้น ห้าม import เข้า Client Component
//          ใช้เฉพาะงานที่ต้องสิทธิ์สูง เช่น เขียน audit log, งาน admin batch
// ===========================================================================
import "server-only"; // ป้องกันการ import ไฟล์นี้เข้าฝั่ง client โดยไม่ตั้งใจ

import { createClient as createSupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database";
import { env } from "@/lib/env";

/**
 * สร้าง Supabase admin client (service role)
 * ปิด session persistence เพราะใช้แบบ stateless ฝั่ง server
 */
export function createAdminClient() {
  if (!env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("ไม่พบ SUPABASE_SERVICE_ROLE_KEY ใน environment");
  }

  return createSupabaseClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: { autoRefreshToken: false, persistSession: false },
    },
  );
}
