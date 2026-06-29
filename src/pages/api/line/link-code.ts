import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";

const adminClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
  { auth: { autoRefreshToken: false, persistSession: false } },
);

function generateCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// POST /api/line/link-code   — สร้าง OTP code สำหรับเชื่อม LINE
// DELETE /api/line/link-code — ยกเลิกการเชื่อม LINE
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === "POST") {
    const { userId } = req.body ?? {};
    if (!userId) return res.status(400).json({ error: "Missing userId" });

    // ลบ code เก่าของ user ออกก่อน
    await adminClient.from("line_link_codes").delete().eq("user_id", userId);

    const code = generateCode();
    const { error } = await adminClient.from("line_link_codes").insert({
      code,
      user_id: userId,
      expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
    });

    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ code, expiresIn: "10 นาที" });
  }

  if (req.method === "DELETE") {
    const { userId } = req.body ?? {};
    if (!userId) return res.status(400).json({ error: "Missing userId" });

    const { error } = await adminClient
      .from("profiles")
      .update({ line_user_id: null })
      .eq("id", userId);

    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ ok: true });
  }

  return res.status(405).json({ error: "Method not allowed" });
}
