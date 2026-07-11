// ===========================================================================
// GET /line/link?linkToken=xxx
// ปลายทางที่ผู้ใช้ถูกส่งมาหลังกดปุ่มเชื่อมบัญชีในแชท LINE
// - ต้องล็อกอินก่อน (ถ้ายัง → เด้งไป /login แล้วกลับมาที่ลิงก์เดิม)
// - สร้าง nonce ผูกกับ user แล้วส่งต่อไปหน้ายืนยันของ LINE (accountLink dialog)
// ===========================================================================
import { NextResponse, type NextRequest } from "next/server";
import { randomBytes } from "crypto";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";

const NONCE_TTL_MS = 10 * 60 * 1000; // 10 นาที
const LINE_ACCOUNT_LINK_URL = "https://access.line.me/dialog/bot/accountLink";

const adminClient = createAdminClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const linkToken = searchParams.get("linkToken");

  if (!linkToken) {
    return NextResponse.redirect(`${origin}/profile?line=link_error`);
  }

  // ต้องล็อกอินก่อน — ถ้ายัง เด้งไปล็อกอินแล้วกลับมาที่ลิงก์นี้ (พร้อม linkToken)
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    const returnTo = `/line/link?linkToken=${encodeURIComponent(linkToken)}`;
    return NextResponse.redirect(`${origin}/login?next=${encodeURIComponent(returnTo)}`);
  }

  // สร้าง nonce ผูกกับ user นี้ (service role — ไม่ติด RLS)
  const nonce = randomBytes(16).toString("hex");
  const { error } = await adminClient.from("line_link_nonces").insert({
    nonce,
    user_id: user.id,
    expires_at: new Date(Date.now() + NONCE_TTL_MS).toISOString(),
  });

  if (error) {
    console.error("[line-link] insert nonce failed:", error);
    return NextResponse.redirect(`${origin}/profile?line=link_error`);
  }

  // ส่งต่อไปหน้ายืนยันของ LINE — LINE จะยิง accountLink event กลับมาที่ webhook
  const dialogUrl = `${LINE_ACCOUNT_LINK_URL}?linkToken=${encodeURIComponent(linkToken)}&nonce=${nonce}`;
  return NextResponse.redirect(dialogUrl);
}
