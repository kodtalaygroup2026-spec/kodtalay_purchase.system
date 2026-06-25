// ===========================================================================
// File: src/lib/supabase/server.ts
// คำอธิบาย: สร้าง Supabase client สำหรับฝั่ง server (Server Components,
//          Route Handlers, Server Actions) โดยอ่าน/เขียน session ผ่าน cookies
// ===========================================================================
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import type { Database } from "@/types/database";
import { env } from "@/lib/env";

/**
 * สร้าง Supabase client ฝั่ง server ที่ผูกกับ cookies ของ request ปัจจุบัน
 * ใช้ anon key + session ของผู้ใช้ จึงยังอยู่ภายใต้ RLS
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // ถูกเรียกจาก Server Component ที่แก้ไข cookie ไม่ได้ — ปล่อยผ่านได้
            // เพราะมี middleware ทำหน้าที่ refresh session อยู่แล้ว
          }
        },
      },
    },
  );
}
