import { env } from "@/lib/env";

const LINE_PUSH_URL = "https://api.line.me/v2/bot/message/push";
const LINE_REPLY_URL = "https://api.line.me/v2/bot/message/reply";
const LINE_MULTICAST_URL = "https://api.line.me/v2/bot/message/multicast";

/** LINE จำกัดผู้รับ 500 คนต่อการเรียก multicast หนึ่งครั้ง */
const MULTICAST_CHUNK_SIZE = 500;

function lineHeaders() {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${env.LINE_CHANNEL_ACCESS_TOKEN}`,
  };
}

/** ส่ง push message ไปหา LINE user (ต้องมี line_user_id) */
export async function sendLineMessage(lineUserId: string, text: string): Promise<void> {
  if (!env.LINE_CHANNEL_ACCESS_TOKEN || !lineUserId) return;
  try {
    const res = await fetch(LINE_PUSH_URL, {
      method: "POST",
      headers: lineHeaders(),
      body: JSON.stringify({
        to: lineUserId,
        messages: [{ type: "text", text }],
      }),
    });
    if (!res.ok) {
      console.error("LINE push failed:", await res.text());
    }
  } catch (err) {
    console.error("LINE sendMessage error:", err);
  }
}

/**
 * ส่งข้อความเดียวกันไปหาหลายคนในคำขอเดียว
 * ประหยัดกว่า push วนลูป (โควตายังนับตามจำนวนผู้รับเหมือนเดิม)
 */
export async function sendLineMulticast(lineUserIds: string[], text: string): Promise<void> {
  if (!env.LINE_CHANNEL_ACCESS_TOKEN) return;

  const uniqueIds = [...new Set(lineUserIds.filter(Boolean))];
  if (uniqueIds.length === 0) return;

  // ผู้รับคนเดียว — LINE แนะนำให้ใช้ push
  if (uniqueIds.length === 1) {
    await sendLineMessage(uniqueIds[0], text);
    return;
  }

  for (let start = 0; start < uniqueIds.length; start += MULTICAST_CHUNK_SIZE) {
    const chunk = uniqueIds.slice(start, start + MULTICAST_CHUNK_SIZE);
    try {
      const res = await fetch(LINE_MULTICAST_URL, {
        method: "POST",
        headers: lineHeaders(),
        body: JSON.stringify({
          to: chunk,
          messages: [{ type: "text", text }],
        }),
      });
      if (!res.ok) {
        console.error("LINE multicast failed:", await res.text());
      }
    } catch (err) {
      console.error("LINE sendMulticast error:", err);
    }
  }
}

/** ตอบกลับ event ของ LINE ด้วย message objects ดิบ (รองรับ text / template / flex) */
export async function sendLineReplyMessages(
  replyToken: string,
  messages: Record<string, unknown>[],
): Promise<void> {
  if (!env.LINE_CHANNEL_ACCESS_TOKEN) {
    console.error("[line-reply] LINE_CHANNEL_ACCESS_TOKEN ไม่ได้ถูกตั้งค่า");
    return;
  }
  if (!replyToken || messages.length === 0) return;

  try {
    const res = await fetch(LINE_REPLY_URL, {
      method: "POST",
      headers: lineHeaders(),
      body: JSON.stringify({ replyToken, messages }),
    });
    // LINE ปฏิเสธเงียบ ๆ ได้หลายกรณี เช่น token ผิด channel หรือ OA อยู่โหมดแชท
    if (!res.ok) {
      console.error(`[line-reply] LINE ตอบ ${res.status}:`, await res.text());
    }
  } catch (err) {
    console.error("[line-reply] error:", err);
  }
}

/** ตอบกลับ event ของ LINE ด้วยข้อความ text (ใช้ replyToken จาก webhook) */
export async function sendLineReply(replyToken: string, text: string): Promise<void> {
  await sendLineReplyMessages(replyToken, [{ type: "text", text }]);
}

/**
 * ออก linkToken สำหรับ Account Link — ต้องรู้ userId ก่อน (จาก webhook event)
 * linkToken อายุสั้น (~10 นาที) ใช้ได้ครั้งเดียว
 */
export async function issueLinkToken(lineUserId: string): Promise<string | null> {
  if (!env.LINE_CHANNEL_ACCESS_TOKEN || !lineUserId) return null;
  try {
    const res = await fetch(`https://api.line.me/v2/bot/user/${lineUserId}/linkToken`, {
      method: "POST",
      headers: lineHeaders(),
    });
    if (!res.ok) {
      console.error(`[line-linkToken] LINE ตอบ ${res.status}:`, await res.text());
      return null;
    }
    const data = (await res.json()) as { linkToken?: string };
    return data.linkToken ?? null;
  } catch (err) {
    console.error("[line-linkToken] error:", err);
    return null;
  }
}
