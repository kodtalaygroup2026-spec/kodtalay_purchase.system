// ===========================================================================
// File: src/lib/supabase/middleware.ts
// คำอธิบาย: ตรรกะ refresh session ของ Supabase สำหรับใช้ใน Next.js middleware
//          ทำหน้าที่ต่ออายุ token และป้องกันหน้าเว็บที่ต้องล็อกอิน
// ===========================================================================
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { env } from "@/lib/env";

// เส้นทางที่เข้าได้โดยไม่ต้องล็อกอิน
const PUBLIC_PATHS = ["/login", "/auth"];

// เส้นทางที่ระบบภายนอกเรียกเข้ามา — ไม่มี session cookie จึงต้องข้าม middleware ทั้งหมด
// ไม่ใช่ช่องโหว่: webhook ตรวจสิทธิ์เองด้วยลายเซ็น HMAC ของ LINE
const EXTERNAL_WEBHOOK_PATHS = ["/api/line/webhook"];

/**
 * อัปเดต session ของ Supabase ในทุก request และ redirect ไป /login
 * ถ้าผู้ใช้ยังไม่ได้ล็อกอินและพยายามเข้าหน้า protected
 */
export async function updateSession(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // ต้องเช็คก่อนทุกอย่าง ไม่งั้น LINE จะโดน redirect ไป /login แทนที่จะถึง handler
  if (EXTERNAL_WEBHOOK_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next({ request });
  }

  const isPublic = PUBLIC_PATHS.some((p) => pathname.startsWith(p));

  // ถ้า env ยังไม่ได้ตั้งค่า (เช่น build โดยไม่มี env) → redirect ไป login แทน crash
  if (!env.NEXT_PUBLIC_SUPABASE_URL || !env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    if (!isPublic) {
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      return NextResponse.redirect(url);
    }
    return NextResponse.next({ request });
  }

  let response = NextResponse.next({ request });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createServerClient<any>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        setAll(cookiesToSet: any[]) {
          cookiesToSet.forEach(({ name, value }: { name: string; value: string }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }: { name: string; value: string; options?: Record<string, unknown> }) =>
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

  // ยังไม่ล็อกอิน + เข้าหน้า protected → ส่งไปหน้า login
  if (!user && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  return response;
}
