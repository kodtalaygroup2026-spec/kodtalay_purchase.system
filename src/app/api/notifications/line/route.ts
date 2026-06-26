import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await request.json() as {
      prId: string;
      event: "submitted" | "approved" | "rejected";
      targetUserId?: string;
      note?: string;
    };

    const { prId, event, targetUserId, note } = body;
    if (!prId || !event) {
      return NextResponse.json({ error: "prId and event are required" }, { status: 400 });
    }

    const { createClient } = await import("@/lib/supabase/server");
    const { createAdminClient } = await import("@/lib/supabase/admin");
    const { sendLinePushMessage, buildPRNotificationMessage } = await import("@/lib/line/sendMessage");

    const supabase = await createClient();
    const { data: pr } = await supabase
      .from("purchase_requisitions")
      .select("pr_number, title, total_amount, profiles!requester_id(full_name)")
      .eq("id", prId)
      .single();

    if (!pr) {
      return NextResponse.json({ error: "PR not found" }, { status: 404 });
    }

    const admin = createAdminClient() as any;
    let lineUserId: string | null = null;

    if (targetUserId) {
      const { data: profile } = await admin
        .from("profiles")
        .select("line_user_id")
        .eq("id", targetUserId)
        .single();
      lineUserId = profile?.line_user_id ?? null;
    }

    if (!lineUserId) {
      return NextResponse.json({ ok: true, skipped: true, reason: "no_line_user_id" });
    }

    const requester = pr.profiles as unknown as { full_name: string } | null;
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

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("LINE notification error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
