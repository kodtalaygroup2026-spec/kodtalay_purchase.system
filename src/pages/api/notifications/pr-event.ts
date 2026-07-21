import type { NextApiRequest, NextApiResponse } from "next";
import { notifyPrEvent, type PrNotificationEvent } from "@/lib/line/notifyPrEvent";
import { LINE_NOTIFY_ENABLED } from "@/lib/config/features";

const ALLOWED_EVENTS: PrNotificationEvent[] = ["submitted", "evidence_submitted", "verified"];

// POST /api/notifications/pr-event
// Body: { prId, event, actorId?, channel?, origin? }
// เซิร์ฟเวอร์หาผู้รับและประกอบข้อความเอง — client ส่งได้แค่ว่าเกิดเหตุการณ์อะไรกับใบไหน
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // ปิดการแจ้งเตือน LINE ชั่วคราว (feature flag) — ตอบ ok เฉย ๆ ไม่ส่งข้อความ
  if (!LINE_NOTIFY_ENABLED) {
    return res.status(200).json({ ok: true, recipientCount: 0, disabled: true });
  }

  const { prId, event, actorId, channel, origin } = req.body ?? {};

  if (!prId || typeof prId !== "string") {
    return res.status(400).json({ error: "Missing prId" });
  }
  if (!ALLOWED_EVENTS.includes(event)) {
    return res.status(400).json({ error: "Unknown event" });
  }

  // ใช้ origin ที่ client ส่งมาเฉพาะเมื่อเป็น URL จริง ไม่งั้นถอยไปใช้ host ของคำขอ
  const baseUrl =
    typeof origin === "string" && /^https?:\/\//.test(origin)
      ? origin.replace(/\/$/, "")
      : `https://${req.headers.host}`;

  try {
    const recipientCount = await notifyPrEvent({
      prId,
      event,
      actorId: typeof actorId === "string" ? actorId : null,
      baseUrl,
      channel: channel === "petty_cash" || channel === "company" ? channel : null,
    });
    return res.status(200).json({ ok: true, recipientCount });
  } catch (err) {
    console.error("[pr-event] notification failed:", err);
    // แจ้งเตือนล้มเหลวไม่ควรทำให้ฝั่ง client มองว่างานหลักพัง
    return res.status(200).json({ ok: false, recipientCount: 0 });
  }
}
