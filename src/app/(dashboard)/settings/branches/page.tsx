import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { BranchManagement } from "@/components/settings/BranchManagement";

export default async function BranchSettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await (supabase as any)
    .from("profiles")
    .select("role")
    .eq("id", user!.id)
    .single();

  if (profile?.role !== "admin") {
    redirect("/");
  }

  const { data: branches } = await (supabase as any)
    .from("branches")
    .select("*")
    .order("code");

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-slate-800">จัดการสาขา</h1>
        <p className="text-sm text-slate-500">เพิ่ม แก้ไข หรือปิดใช้งานสาขา</p>
      </div>
      <BranchManagement initialBranches={branches ?? []} />
    </div>
  );
}
