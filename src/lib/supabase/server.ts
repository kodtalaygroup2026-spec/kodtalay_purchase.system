// ===========================================================================
// File: src/lib/supabase/server.ts
// คำอธิบาย: สร้าง Supabase client สำหรับฝั่ง server (Server Components,
//          Route Handlers, Server Actions) โดยอ่าน/เขียน session ผ่าน cookies
// ===========================================================================
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import { env } from "@/lib/env";

/**
 * สร้าง Supabase client ฝั่ง server ที่ผูกกับ cookies ของ request ปัจจุบัน
 * ใช้ anon key + session ของผู้ใช้ จึงยังอยู่ภายใต้ RLS
 * หมายเหตุ: ใช้ untyped client ไปก่อน จนกว่าจะ generate types จาก Supabase CLI
 */
export async function createClient() {
  const cookieStore = await cookies();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return createServerClient<any>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        setAll(cookiesToSet: any[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }: { name: string; value: string; options: Record<string, unknown> }) =>
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
