// ===========================================================================
// File: src/middleware.ts
// คำอธิบาย: Next.js middleware — ทำงานก่อนทุก request เพื่อ refresh session
//          และบังคับการล็อกอินสำหรับหน้าที่ต้องป้องกัน
// ===========================================================================
import { type NextRequest } from "next/server";

import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  // ทำงานทุกเส้นทาง ยกเว้น static asset และไฟล์รูป เพื่อประสิทธิภาพ
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
