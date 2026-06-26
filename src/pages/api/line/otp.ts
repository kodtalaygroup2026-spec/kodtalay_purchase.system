import type { NextApiRequest, NextApiResponse } from "next";
import { createServerClient } from "@supabase/ssr";
import { createClient as createAdminSupabaseClient } from "@supabase/supabase-js";

function generateCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

    // สร้าง server client จาก cookies ของ request
    const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        getAll() {
          return Object.entries(req.cookies).map(([name, value]) => ({ name, value: value ?? "" }));
        },
        setAll() { /* Pages Router handles cookies via res */ },
      },
    });

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return res.status(401).json({ error: "Unauthorized" });

    const admin = createAdminSupabaseClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    await (admin as any).from("line_link_codes").delete().eq("user_id", user.id);

    let code = generateCode();
    for (let i = 0; i < 5; i++) {
      const { error } = await (admin as any).from("line_link_codes").insert({ code, user_id: user.id });
      if (!error) break;
      code = generateCode();
    }

    return res.status(200).json({ code });
  } catch (err) {
    console.error("link-code error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}
