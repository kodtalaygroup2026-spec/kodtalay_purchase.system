import type { NextApiRequest, NextApiResponse } from "next";
import crypto from "crypto";
import { createClient } from "@supabase/supabase-js";
import { sendLineReply, sendLineReplyMessages, issueLinkToken } from "@/lib/line/sendMessage";
import { externalBrowserLink } from "@/lib/line/externalLink";

// คำสั่งเริ่มเชื่อมบัญชีแบบกดปุ่ม (Rich Menu ส่งข้อความนี้มา หรือผู้ใช้พิมพ์เอง)
const LINK_TRIGGERS = ["verify", "เชื่อมบัญชี", "เชื่อม", "link", "เชื่อมต่อ"];

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

/**
 * ถาม LINE ว่า access token ที่ตั้งไว้ใช้ได้จริงและเป็นของบอทตัวไหน
 * ใช้แยกว่า token ผิด channel หรือ token หมดอายุ
 */
async function inspectAccessToken(): Promise<{ valid: boolean | null; botBasicId: string | null }> {
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN ?? "";
  if (!token) return { valid: null, botBasicId: null };

  try {
    const res = await fetch("https://api.line.me/v2/bot/info", {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return { valid: false, botBasicId: null };

    const info = (await res.json()) as { basicId?: string };
    return { valid: true, botBasicId: info.basicId ?? null };
  } catch {
    return { valid: null, botBasicId: null };
  }
}

// GET  /api/line/webhook — health check: บอกว่า route ถูก deploy และ env ครบหรือยัง
// POST /api/line/webhook — รับ event จาก LINE Messaging API เพื่อเชื่อม LINE account กับ user
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // เปิดใน browser ได้เลยเพื่อตรวจว่า env ถูกตั้งบนเซิร์ฟเวอร์จริง (ไม่เปิดเผยค่า)
  if (req.method === "GET") {
    const { valid, botBasicId } = await inspectAccessToken();
    return res.status(200).json({
      ok: true,
      endpoint: "line-webhook",
      hasChannelSecret: Boolean(process.env.LINE_CHANNEL_SECRET),
      hasAccessToken: Boolean(process.env.LINE_CHANNEL_ACCESS_TOKEN),
      hasServiceRoleKey: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
      accessTokenValid: valid,
      botBasicId,
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

  const origin = `https://${req.headers.host}`;

  for (const event of body.events ?? []) {
    // ── Account Link — LINE ส่งกลับมาหลังผู้ใช้ยืนยันเชื่อมบัญชี ──
    if (event.type === "accountLink") {
      await handleAccountLink(event);
      continue;
    }

    if (event.type !== "message" || event.message?.type !== "text") continue;

    const text = event.message.text.trim();
    const lineUserId = event.source?.userId;
    if (!lineUserId) continue;

    // คำสั่งกดปุ่มเชื่อมบัญชี → เริ่ม Account Link
    if (LINK_TRIGGERS.includes(text.toLowerCase())) {
      await startAccountLink(event.replyToken, lineUserId, origin);
      continue;
    }

    // รหัส 6 หลัก → เชื่อมบัญชีแบบเดิม (ยังรองรับไว้)
    if (/^\d{6}$/.test(text)) {
      await handleCodeLink(event.replyToken, lineUserId, text);
      continue;
    }

    // ข้อความอื่น — ตอบวิธีใช้ พร้อมปุ่มเชื่อมบัญชี
    console.log("[line-webhook] ข้อความทั่วไป — ส่งปุ่มเชื่อมบัญชี");
    await startAccountLink(event.replyToken, lineUserId, origin);
  }

  return res.status(200).json({ ok: true });
}

/** เริ่มเชื่อมบัญชี — ออก linkToken แล้วตอบด้วยปุ่มเปิดหน้าเชื่อมบัญชี */
async function startAccountLink(replyToken: string, lineUserId: string, origin: string) {
  const linkToken = await issueLinkToken(lineUserId);
  if (!linkToken) {
    await sendLineReply(replyToken, "ขออภัย ระบบเชื่อมบัญชีขัดข้องชั่วคราว กรุณาลองใหม่อีกครั้ง");
    return;
  }

  // เปิดในเบราว์เซอร์ภายนอก (Chrome/Safari) เพราะ Google Login ใช้ในเบราว์เซอร์ของ LINE ไม่ได้
  const linkUrl = externalBrowserLink(`${origin}/line/link?linkToken=${encodeURIComponent(linkToken)}`);

  await sendLineReplyMessages(replyToken, [
    {
      type: "template",
      altText: "เชื่อมบัญชีระบบจัดซื้อกับ LINE",
      template: {
        type: "buttons",
        title: "เชื่อมบัญชีระบบจัดซื้อ",
        text: "กดปุ่มด้านล่างเพื่อเข้าสู่ระบบและเชื่อม LINE นี้เข้ากับบัญชีของคุณ",
        actions: [{ type: "uri", label: "เชื่อมบัญชี", uri: linkUrl }],
      },
    },
  ]);
}

/** เชื่อมบัญชีด้วยรหัส 6 หลัก (ช่องทางเดิม) */
async function handleCodeLink(replyToken: string, lineUserId: string, code: string) {
  const { data: linkCode } = await adminClient
    .from("line_link_codes")
    .select("user_id, expires_at")
    .eq("code", code)
    .maybeSingle();

  if (linkCode && new Date(linkCode.expires_at) > new Date()) {
    await adminClient.from("profiles").update({ line_user_id: lineUserId }).eq("id", linkCode.user_id);
    await adminClient.from("line_link_codes").delete().eq("code", code);
    console.log(`[line-webhook] เชื่อมบัญชี (code) สำเร็จ user=${linkCode.user_id}`);
    await sendLineReply(
      replyToken,
      "✅ เชื่อม LINE สำเร็จ!\nคุณจะได้รับการแจ้งเตือนจากระบบจัดซื้อผ่าน LINE นี้",
    );
  } else {
    console.log(`[line-webhook] รหัส ${code} ${linkCode ? "หมดอายุ" : "ไม่พบในระบบ"}`);
    await sendLineReply(replyToken, "❌ รหัสไม่ถูกต้องหรือหมดอายุแล้ว กรุณาขอรหัสใหม่จากระบบ");
  }
}

/** รับ accountLink event จาก LINE แล้วจับคู่ nonce → บันทึก line_user_id */
async function handleAccountLink(event: LineEvent) {
  const nonce = event.link?.nonce;
  const lineUserId = event.source?.userId;

  if (event.link?.result !== "ok" || !nonce || !lineUserId) {
    console.log("[line-webhook] accountLink ล้มเหลวหรือข้อมูลไม่ครบ");
    if (event.replyToken) {
      await sendLineReply(event.replyToken, "การเชื่อมบัญชีไม่สำเร็จ กรุณาลองใหม่อีกครั้ง");
    }
    return;
  }

  const { data: row } = await adminClient
    .from("line_link_nonces")
    .select("user_id, expires_at")
    .eq("nonce", nonce)
    .maybeSingle();

  if (!row || new Date(row.expires_at) < new Date()) {
    console.log(`[line-webhook] nonce ${nonce} ${row ? "หมดอายุ" : "ไม่พบ"}`);
    await sendLineReply(event.replyToken, "ลิงก์เชื่อมบัญชีหมดอายุ กรุณาเริ่มใหม่อีกครั้ง");
    return;
  }

  await adminClient.from("profiles").update({ line_user_id: lineUserId }).eq("id", row.user_id);
  await adminClient.from("line_link_nonces").delete().eq("nonce", nonce);

  console.log(`[line-webhook] เชื่อมบัญชี (accountLink) สำเร็จ user=${row.user_id}`);
  await sendLineReply(
    event.replyToken,
    "✅ เชื่อม LINE สำเร็จ!\nคุณจะได้รับการแจ้งเตือนจากระบบจัดซื้อผ่าน LINE นี้",
  );
}

// ── Types ─────────────────────────────────────────────────────────────────────
interface LineEvent {
  type: string;
  replyToken: string;
  source?: { userId?: string };
  message?: { type: string; text: string };
  link?: { result: string; nonce: string };
}
