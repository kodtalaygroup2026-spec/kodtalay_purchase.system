import type { NextApiRequest, NextApiResponse } from "next";
import { createServerClient } from "@supabase/ssr";
import { createClient as createAdminSupabaseClient } from "@supabase/supabase-js";
import { sendLinePushMessage, buildPRNotificationMessage } from "@/lib/line/sendMessage";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const body = req.body as {
      prId: string;
      event: "submitted" | "approved" | "rejected";
      targetUserId?: string;
      note?: string;
    };

    const { prId, event, targetUserId, note } = body;
    if (!prId || !event) {
      return res.status(400).json({ error: "prId and event are required" });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

    const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        getAll() {
          return Object.entries(req.cookies).map(([name, value]) => ({ name, value: value ?? "" }));
        },
        setAll() {},
      },
    });

    const { data: pr } = await supabase
      .from("purchase_requisitions")
      .select("pr_number, title, total_amount, profiles!requester_id(full_name)")
      .eq("id", prId)
      .single();

    if (!pr) {
      return res.status(404).json({ error: "PR not found" });
    }

    const admin = createAdminSupabaseClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    let lineUserId: string | null = null;

    if (targetUserId) {
      const { data: profile } = await (admin as any)
        .from("profiles")
        .select("line_user_id")
        .eq("id", targetUserId)
        .single();
      lineUserId = profile?.line_user_id ?? null;
    }

    if (!lineUserId) {
      return res.status(200).json({ ok: true, skipped: true, reason: "no_line_user_id" });
    }

    const requester = (pr as any).profiles as { full_name: string } | null;
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

    const messageText = buildPRNotificationMessage({
      event,
      prNumber: pr.pr_number,
      title: pr.title,
      requesterName: requester?.full_name ?? "—",
      totalAmount: pr.total_amount,
      prUrl: `${baseUrl}/requisitions/${prId}`,
      note,
    });

    await sendLinePushMessage(lineUserId, [{ type: "text", text: messageText }]);

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error("LINE notification error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}
