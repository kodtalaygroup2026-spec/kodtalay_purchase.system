import type { NextApiRequest, NextApiResponse } from "next";
import crypto from "crypto";
import { createClient } from "@supabase/supabase-js";
import { sendLineReply } from "@/lib/line/sendMessage";

export const config = {
  api: { bodyParser: false }, // ต้องการ raw body สำหรับ HMAC verification
};

const adminClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
  { auth: { autoRefreshToken: false, persistSession: false } },
);

async function getRawBody(req: NextApiRequest): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk: Buffer) => (data += chunk.toString("utf8")));
    req.on("end", () => resolve(data));
    req.on("error", reject);
  });
}

function verifySignature(rawBody: string, signature: string, secret: string): boolean {
  if (!secret || !signature) return false;
  const hash = crypto
    .createHmac("SHA256", secret)
    .update(rawBody)
    .digest("base64");
  return hash === signature;
}

// GET  /api/line/webhook — health check: บอกว่า route ถูก deploy และ env ครบหรือยัง
// POST /api/line/webhook — รับ event จาก LINE Messaging API เพื่อเชื่อม LINE account กับ user
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // เปิดใน browser ได้เลยเพื่อตรวจว่า env ถูกตั้งบนเซิร์ฟเวอร์จริง (ไม่เปิดเผยค่า)
  if (req.method === "GET") {
    return res.status(200).json({
      ok: true,
      endpoint: "line-webhook",
      hasChannelSecret: Boolean(process.env.LINE_CHANNEL_SECRET),
      hasAccessToken: Boolean(process.env.LINE_CHANNEL_ACCESS_TOKEN),
      hasServiceRoleKey: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
    });
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const rawBody = await getRawBody(req);
  const signature = req.headers["x-line-signature"] as string;
  const secret = process.env.LINE_CHANNEL_SECRET ?? "";

  if (!secret) {
    console.error("[line-webhook] LINE_CHANNEL_SECRET ไม่ได้ถูกตั้งค่าบนเซิร์ฟเวอร์");
    return res.status(403).json({ error: "Server not configured" });
  }
  if (!verifySignature(rawBody, signature, secret)) {
    console.error("[line-webhook] ลายเซ็นไม่ถูกต้อง — channel secret อาจไม่ตรงกับ channel ที่ตั้ง webhook ไว้");
    return res.status(403).json({ error: "Invalid signature" });
  }

  let body: { events?: LineEvent[] };
  try {
    body = JSON.parse(rawBody);
  } catch {
    return res.status(400).json({ error: "Invalid JSON" });
  }

  // events ว่าง = LINE กดปุ่ม Verify — ตอบ 200 ให้ผ่าน
  console.log(`[line-webhook] ได้รับ ${body.events?.length ?? 0} event`);

  for (const event of body.events ?? []) {
    if (event.type !== "message" || event.message?.type !== "text") continue;

    const code = event.message.text.trim();
    const lineUserId = event.source?.userId;
    if (!lineUserId) continue;

    // ข้อความที่ไม่ใช่รหัส 6 หลัก — ตอบวิธีใช้ เพื่อยืนยันว่า webhook ทำงาน
    if (!/^\d{6}$/.test(code)) {
      console.log("[line-webhook] ข้อความไม่ใช่รหัส 6 หลัก");
      await sendLineReply(
        event.replyToken,
        "กรุณาส่งรหัส 6 หลักที่ได้จากหน้าโปรไฟล์ในระบบจัดซื้อ\n(รหัสมีอายุ 10 นาที)",
      );
      continue;
    }

    const { data: linkCode } = await adminClient
      .from("line_link_codes")
      .select("user_id, expires_at")
      .eq("code", code)
      .maybeSingle();

    if (linkCode && new Date(linkCode.expires_at) > new Date()) {
      await adminClient
        .from("profiles")
        .update({ line_user_id: lineUserId })
        .eq("id", linkCode.user_id);

      await adminClient.from("line_link_codes").delete().eq("code", code);

      console.log(`[line-webhook] เชื่อมบัญชีสำเร็จ user=${linkCode.user_id}`);
      await sendLineReply(
        event.replyToken,
        "✅ เชื่อม LINE สำเร็จ!\nคุณจะได้รับการแจ้งเตือนจากระบบจัดซื้อผ่าน LINE นี้",
      );
    } else {
      console.log(`[line-webhook] รหัส ${code} ${linkCode ? "หมดอายุ" : "ไม่พบในระบบ"}`);
      await sendLineReply(event.replyToken, "❌ รหัสไม่ถูกต้องหรือหมดอายุแล้ว กรุณาขอรหัสใหม่จากระบบ");
    }
  }

  return res.status(200).json({ ok: true });
}

// ── Types ─────────────────────────────────────────────────────────────────────
interface LineEvent {
  type: string;
  replyToken: string;
  source?: { userId?: string };
  message?: { type: string; text: string };
}
