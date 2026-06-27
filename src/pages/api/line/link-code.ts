import { createClient } from "@supabase/supabase-js";
import type { NextApiRequest, NextApiResponse } from "next";

// POST /api/line/link-code
// ตรวจสอบ OTP code แล้วเชื่อม LINE user_id กับ profile
// ใช้ service role เพราะ endpoint นี้ถูกเรียกจาก LINE webhook (ไม่มี user session)
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { code, lineUserId } = req.body as {
    code?: string;
    lineUserId?: string;
  };

  if (!code || !lineUserId) {
    return res.status(400).json({ error: "Missing code or lineUserId" });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    return res.status(500).json({ error: "Server configuration error" });
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  try {
    // ค้นหา profile ที่มี line_link_code ตรงกัน และยังไม่หมดอายุ
    const { data: profile, error } = await supabase
      .from("profiles")
      .select("id")
      .eq("line_link_code", code)
      .gt("line_link_expires_at", new Date().toISOString())
      .single();

    if (error || !profile) {
      return res.status(404).json({ error: "รหัสไม่ถูกต้องหรือหมดอายุแล้ว" });
    }

    // บันทึก LINE user_id และลบ OTP code
    const { error: updateError } = await supabase
      .from("profiles")
      .update({
        line_user_id: lineUserId,
        line_link_code: null,
        line_link_expires_at: null,
      })
      .eq("id", profile.id);

    if (updateError) {
      return res.status(500).json({ error: "ไม่สามารถบันทึกข้อมูลได้" });
    }

    return res.status(200).json({ success: true });
  } catch {
    return res.status(500).json({ error: "Internal server error" });
  }
}
