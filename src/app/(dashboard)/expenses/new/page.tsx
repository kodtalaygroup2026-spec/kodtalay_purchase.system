import { createClient } from "@/lib/supabase/server";
import { getBranches } from "@/lib/expense/queries";
import { ExpenseForm } from "@/components/expense/ExpenseForm";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";

export default async function NewExpensePage() {
  const [branches, supabase] = await Promise.all([
    getBranches(),
    createClient(),
  ]);

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // หา branch_id ของ user จาก profile
  const { data: profile } = await (supabase as any)
    .from("profiles")
    .select("branch_id")
    .eq("id", user!.id)
    .single();

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <Link
          href="/expenses"
          className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700"
        >
          <ChevronLeft size={16} />
          ใบเบิกค่าใช้จ่าย
        </Link>
      </div>
      <h1 className="text-xl font-bold text-slate-800">สร้างใบเบิกใหม่</h1>

      <ExpenseForm
        branches={branches}
        defaultBranchId={profile?.branch_id ?? undefined}
      />
    </div>
  );
}
