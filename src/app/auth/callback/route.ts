import { createClient } from "@/lib/supabase/server";
import { NextResponse, type NextRequest } from "next/server";

// Google OAuth callback — Supabase redirect มาที่นี่หลัง user อนุมัติ
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  // รับเฉพาะ path ภายในเว็บ (กัน open redirect)
  const nextParam = searchParams.get("next");
  const next = nextParam && nextParam.startsWith("/") && !nextParam.startsWith("//") ? nextParam : "/";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      // login สำเร็จ → ไปหน้า dashboard (หรือหน้าที่ระบุใน ?next=)
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  // มี error หรือไม่มี code → กลับหน้า login พร้อม error flag
  return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`);
}
