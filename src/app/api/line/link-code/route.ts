import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

function generateCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // ตัดตัวที่อ่านยาก I, O, 0, 1 ออก
  return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

// POST /api/line/link-code — สร้างรหัสเชื่อม LINE สำหรับผู้ใช้ที่ login อยู่
export async function POST() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const admin = createAdminClient() as any;

    // ลบ code เก่าของ user นี้ก่อน (ถ้ามี)
    await admin.from("line_link_codes").delete().eq("user_id", user.id);

    // สร้าง code ใหม่ (loop จนกว่าจะไม่ซ้ำ)
    let code = generateCode();
    let attempts = 0;
    while (attempts < 5) {
      const { error } = await admin.from("line_link_codes").insert({ code, user_id: user.id });
      if (!error) break;
      code = generateCode();
      attempts++;
    }

    return NextResponse.json({ code });
  } catch (err) {
    console.error("link-code error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
