import { createHmac } from "crypto";
import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";

interface LineTextMessage { type: "text"; text: string; }
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

async function sendLinePush(lineUserId: string, text: string) {
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  if (!token) return;
  await fetch("https://api.line.me/v2/bot/message/push", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ to: lineUserId, messages: [{ type: "text", text }] }),
  });
}

export const config = { api: { bodyParser: false } };

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).end();

  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  const rawBody = Buffer.concat(chunks).toString();

  const signature = (req.headers["x-line-signature"] as string) ?? "";
  if (!verifySignature(rawBody, signature)) {
    return res.status(401).json({ error: "Invalid signature" });
  }

  let events: LineEvent[] = [];
  try {
    events = (JSON.parse(rawBody) as { events: LineEvent[] }).events ?? [];
  } catch {
    return res.status(400).json({ error: "Bad JSON" });
  }

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  ) as any;

  for (const event of events) {
    if (event.type !== "message" || event.message?.type !== "text") continue;
    const code = event.message.text.trim().toUpperCase();
    const lineUserId = event.source.userId;

    const { data: linkCode } = await admin
      .from("line_link_codes").select("user_id")
      .eq("code", code).gt("expires_at", new Date().toISOString()).maybeSingle();

    if (!linkCode) continue;

    await Promise.all([
      admin.from("profiles").update({ line_user_id: lineUserId }).eq("id", linkCode.user_id),
      admin.from("line_link_codes").delete().eq("code", code),
    ]);

    await sendLinePush(lineUserId, "✅ เชื่อม LINE กับระบบจัดซื้อ Kodtalay สำเร็จแล้ว\nคุณจะได้รับแจ้งเตือนเมื่อมีการดำเนินการที่เกี่ยวข้องกับคุณ");
  }

  return res.status(200).json({ ok: true });
}
