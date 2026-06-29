import { env } from "@/lib/env";

const LINE_PUSH_URL = "https://api.line.me/v2/bot/message/push";
const LINE_REPLY_URL = "https://api.line.me/v2/bot/message/reply";

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
