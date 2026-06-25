// ===========================================================================
// File: src/lib/supabase/client.ts
// คำอธิบาย: สร้าง Supabase client สำหรับใช้งานฝั่ง browser (Client Components)
//          ใช้ anon key ซึ่งปลอดภัยเพราะถูกควบคุมด้วย RLS เสมอ
// ===========================================================================
import { createBrowserClient } from "@supabase/ssr";

import { env } from "@/lib/env";

/**
 * สร้าง Supabase client สำหรับ Client Component
 * เรียกใช้ภายใน component ที่มี "use client"
 * หมายเหตุ: ใช้ untyped client ไปก่อน จนกว่าจะ generate types จาก Supabase CLI
 */
export function createClient() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return createBrowserClient<any>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}
