export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { FileCheck2 } from "lucide-react";
import { FinanceDocumentsList, type DocRow } from "@/components/finance/FinanceDocumentsList";

export default async function FinanceDocumentsPage() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  const isFinance = profile?.role === "finance" || profile?.role === "admin";
  if (!isFinance) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white py-16 text-center">
        <p className="text-slate-500">คุณไม่มีสิทธิ์เข้าถึงหน้านี้</p>
        <p className="mt-1 text-sm text-slate-400">เฉพาะฝ่ายการเงินและผู้ดูแลระบบเท่านั้น</p>
      </div>
    );
  }

  const { data: branchRows } = await (supabase as any)
    .from("branches").select("id, code").order("code");
  const branchCode: Record<string, string> = Object.fromEntries(
    (branchRows ?? []).map((b: any) => [b.id, b.code])
  );

  // PR ที่จ่ายแล้ว
  const { data: paidPRs } = await (supabase as any)
    .from("purchase_requisitions")
    .select("id, pr_number, title, total_amount, actual_amount, branch_id, finance_action_at, profiles!requester_id(full_name)")
    .eq("status", "paid")
    .order("finance_action_at", { ascending: false, nullsFirst: false })
    .limit(300);

  const paidIds = (paidPRs ?? []).map((p: any) => p.id);

  // evidence ล่าสุดของ PR ที่จ่าย (close_status + channel)
  const { data: evRows } =
    paidIds.length > 0
      ? await (supabase as any)
          .from("payment_evidences")
          .select("pr_id, close_status, payment_channel, submitted_at")
          .in("pr_id", paidIds)
          .order("submitted_at", { ascending: false })
      : { data: [] };
  const evMap: Record<string, any> = {};
  for (const ev of evRows ?? []) {
    if (!evMap[ev.pr_id]) evMap[ev.pr_id] = ev;
  }

  const docs: DocRow[] = (paidPRs ?? []).map((pr: any) => {
    const ev = evMap[pr.id] ?? null;
    return {
      id: pr.id,
      pr_number: pr.pr_number,
      title: pr.title,
      amount: pr.actual_amount ?? pr.total_amount ?? 0,
      branch_code: pr.branch_id ? (branchCode[pr.branch_id] ?? "—") : "—",
      requester_name: pr.profiles?.full_name ?? "—",
      paid_at: pr.finance_action_at ?? null,
      payment_channel: ev?.payment_channel ?? null,
      close_status: ev?.close_status ?? null,
    };
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100">
          <FileCheck2 size={20} className="text-slate-600" />
        </div>
        <div>
          <h1 className="text-lg font-bold text-slate-900">งานเอกสารสมบูรณ์</h1>
          <p className="text-sm text-slate-500">เอกสารที่จ่ายแล้ว — แยกตามสถานะเอกสาร (สมบูรณ์ / ค้างเอกสาร)</p>
        </div>
      </div>

      <FinanceDocumentsList docs={docs} />
    </div>
  );
}
