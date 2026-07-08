export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AlertTriangle } from "lucide-react";
import { IncompleteDocsList, type IncompleteDoc } from "@/components/evidence/IncompleteDocsList";

export default async function IncompleteDocsPage() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // เอกสารของตัวเองที่ค้าง (close_status = incomplete)
  const { data: evRows } = await (supabase as any)
    .from("payment_evidences")
    .select("id, pr_id, review_note, close_status, submitted_at")
    .eq("submitted_by", user.id)
    .eq("close_status", "incomplete")
    .order("submitted_at", { ascending: false });

  const prIds = [...new Set((evRows ?? []).map((e: any) => e.pr_id))];

  const { data: prs } =
    prIds.length > 0
      ? await (supabase as any)
          .from("purchase_requisitions")
          .select("id, pr_number, title, total_amount, actual_amount, finance_action_at")
          .in("id", prIds)
      : { data: [] };
  const prMap: Record<string, any> = Object.fromEntries((prs ?? []).map((p: any) => [p.id, p]));

  const docs: IncompleteDoc[] = (evRows ?? [])
    .map((ev: any) => {
      const pr = prMap[ev.pr_id];
      if (!pr) return null;
      return {
        id: pr.id,
        pr_number: pr.pr_number,
        title: pr.title,
        amount: pr.actual_amount ?? pr.total_amount ?? 0,
        evidence_id: ev.id,
        paid_at: pr.finance_action_at ?? null,
        review_note: ev.review_note ?? null,
      };
    })
    .filter(Boolean) as IncompleteDoc[];

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100">
          <AlertTriangle size={20} className="text-amber-600" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-slate-800">งานเอกสารไม่สมบูรณ์</h1>
          <p className="text-sm text-slate-500">
            เอกสารที่จ่ายแล้วแต่ยังค้างใบกำกับ/เอกสารตัวจริง — แนบเอกสารแล้วกดยืนยันเพื่อปิดให้สมบูรณ์
          </p>
        </div>
      </div>

      <IncompleteDocsList docs={docs} currentUserId={user.id} />
    </div>
  );
}
