import type { NextApiRequest, NextApiResponse } from "next";
import { sendLineMessage } from "@/lib/line/sendMessage";

// POST /api/notifications/line
// Body: { lineUserId: string, message: string }
// เรียกจาก client component หลัง PR status เปลี่ยน
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { lineUserId, message } = req.body ?? {};
  if (!lineUserId || !message) {
    return res.status(400).json({ error: "Missing lineUserId or message" });
  }

  await sendLineMessage(lineUserId as string, message as string);
  return res.status(200).json({ ok: true });
}
