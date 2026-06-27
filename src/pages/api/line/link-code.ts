import type { NextApiRequest, NextApiResponse } from "next";

// POST /api/line/link-code — LINE account linking via OTP
// หมายเหตุ: implement เต็มรูปแบบเมื่อ restore LINE API ครบ
export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }
  return res.status(503).json({ error: "LINE integration not yet configured" });
}
