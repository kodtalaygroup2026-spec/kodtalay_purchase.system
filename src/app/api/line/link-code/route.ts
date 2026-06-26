import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

function generateCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

export async function POST() {
  try {
    const { createClient } = await import("@/lib/supabase/server");
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { createAdminClient } = await import("@/lib/supabase/admin");
    const admin = createAdminClient() as any;

    await admin.from("line_link_codes").delete().eq("user_id", user.id);

    let code = generateCode();
    let attempts = 0;
    while (attempts < 5) {
      const { error } = await admin.from("line_link_codes").insert({ code, user_id: user.id });
      if (!error) break;
      code = generateCode();
      attempts++;
    }

    return NextResponse.json({ code });
  } catch (err) {
    console.error("link-code error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
