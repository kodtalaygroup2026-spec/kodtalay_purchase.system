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

/** ตอบกลับ event ของ LINE (ใช้ replyToken จาก webhook) */
export async function sendLineReply(replyToken: string, text: string): Promise<void> {
  if (!env.LINE_CHANNEL_ACCESS_TOKEN || !replyToken) return;
  try {
    await fetch(LINE_REPLY_URL, {
      method: "POST",
      headers: lineHeaders(),
      body: JSON.stringify({
        replyToken,
        messages: [{ type: "text", text }],
      }),
    });
  } catch (err) {
    console.error("LINE reply error:", err);
  }
}
