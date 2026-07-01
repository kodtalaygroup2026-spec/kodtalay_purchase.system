import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Sidebar } from "@/components/layout/Sidebar";
import { Navbar } from "@/components/layout/Navbar";
import { MobileNav } from "@/components/layout/MobileNav";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, email, role, department, line_user_id")
    .eq("id", user.id)
    .single();

  if (!profile) {
    redirect("/login");
  }

  const avatarUrl = user.user_metadata?.avatar_url as string | undefined;

  // นับรายการที่รอการอนุมัติตาม role
  let approvalCount = 0;
  let editedCount = 0;
  if (profile.role === "manager" || profile.role === "admin") {
    const [{ count }, { data: editedPRIds }] = await Promise.all([
      (supabase as any)
        .from("purchase_requisitions")
        .select("id", { count: "exact", head: true })
        .in("status", ["submitted", "pending_second_approval"]),
      (supabase as any)
        .from("pr_item_edit_logs")
        .select("pr_id")
        .limit(200),
    ]);
    approvalCount = count ?? 0;
    editedCount = new Set(((editedPRIds ?? []) as any[]).map((r) => r.pr_id)).size;
  }

  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar role={profile.role} approvalCount={approvalCount} editedCount={editedCount} />
      <div className="flex flex-1 flex-col min-w-0">
        <Navbar profile={profile} avatarUrl={avatarUrl} />
        <main className="flex-1 px-4 py-6 pb-24 lg:pb-6 lg:px-6">
          {children}
        </main>
        <MobileNav />
      </div>
    </div>
  );
}
