import { createHmac } from "crypto";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendLinePushMessage } from "@/lib/line/sendMessage";

interface LineTextMessage {
  type: "text";
  text: string;
}

interface LineEvent {
  type: string;
  source: { userId: string };
  message?: LineTextMessage;
}

function verifySignature(rawBody: string, signature: string): boolean {
  const secret = process.env.LINE_CHANNEL_SECRET ?? "";
  if (!secret) return false;
  const expected = createHmac("sha256", secret).update(rawBody).digest("base64");
  return expected === signature;
}

// POST /api/line/webhook — รับ event จาก LINE Platform
export async function POST(request: Request) {
  const rawBody = await request.text();
  const signature = request.headers.get("x-line-signature") ?? "";

  if (!verifySignature(rawBody, signature)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let events: LineEvent[] = [];
  try {
    const parsed = JSON.parse(rawBody) as { events: LineEvent[] };
    events = parsed.events ?? [];
  } catch {
    return NextResponse.json({ error: "Bad JSON" }, { status: 400 });
  }

  const admin = createAdminClient() as any;

  for (const event of events) {
    if (event.type !== "message" || event.message?.type !== "text") continue;

    const code = event.message.text.trim().toUpperCase();
    const lineUserId = event.source.userId;

    // ค้นหา code ที่ยังไม่หมดอายุ
    const { data: linkCode } = await admin
      .from("line_link_codes")
      .select("user_id")
      .eq("code", code)
      .gt("expires_at", new Date().toISOString())
      .maybeSingle();

    if (!linkCode) continue;

    // บันทึก line_user_id และลบ code ที่ใช้แล้ว
    await Promise.all([
      admin.from("profiles").update({ line_user_id: lineUserId }).eq("id", linkCode.user_id),
      admin.from("line_link_codes").delete().eq("code", code),
    ]);

    await sendLinePushMessage(lineUserId, [
      { type: "text", text: "✅ เชื่อม LINE กับระบบจัดซื้อ Kodtalay สำเร็จแล้ว\nคุณจะได้รับแจ้งเตือนเมื่อมีการดำเนินการที่เกี่ยวข้องกับคุณ" },
    ]);
  }

  return NextResponse.json({ ok: true });
}
