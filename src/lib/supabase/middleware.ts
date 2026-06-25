// ===========================================================================
// File: src/lib/supabase/middleware.ts
// คำอธิบาย: ตรรกะ refresh session ของ Supabase สำหรับใช้ใน Next.js middleware
//          ทำหน้าที่ต่ออายุ token และป้องกันหน้าเว็บที่ต้องล็อกอิน
// ===========================================================================
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import type { Database } from "@/types/database";
import { env } from "@/lib/env";

// เส้นทางที่เข้าได้โดยไม่ต้องล็อกอิน
const PUBLIC_PATHS = ["/login", "/auth"];

/**
 * อัปเดต session ของ Supabase ในทุก request และ redirect ไป /login
 * ถ้าผู้ใช้ยังไม่ได้ล็อกอินและพยายามเข้าหน้า protected
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // สำคัญ: ต้องเรียก getUser() เพื่อ refresh token — ห้ามลบบรรทัดนี้
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const isPublic = PUBLIC_PATHS.some((p) => pathname.startsWith(p));

  // ยังไม่ล็อกอิน + เข้าหน้า protected → ส่งไปหน้า login
  if (!user && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  return response;
}
