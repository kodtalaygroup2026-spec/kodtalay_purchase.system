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

  // ── ยิงพร้อมกัน: บริษัท / PR จ่ายแล้ว / หลักฐานไม่สมบูรณ์ — สามตัวนี้อิสระต่อกัน ──
  const [{ data: branchRows }, { data: paidPRs }, { data: incEvRows }] = await Promise.all([
    (supabase as any).from("branches").select("id, code").order("code"),
    (supabase as any)
      .from("purchase_requisitions")
      .select("id, pr_number, title, total_amount, actual_amount, branch_id, finance_action_at, profiles!requester_id(full_name)")
      .eq("status", "paid")
      .order("finance_action_at", { ascending: false, nullsFirst: false })
      .limit(300),
    (supabase as any)
      .from("payment_evidences")
      .select("pr_id, status, close_status, payment_channel, review_note, reviewed_at, submitted_at")
      .eq("close_status", "incomplete")
      .order("submitted_at", { ascending: false })
      .limit(300),
  ]);

  const branchCode: Record<string, string> = Object.fromEntries(
    (branchRows ?? []).map((b: any) => [b.id, b.code])
  );

  const paidIds = (paidPRs ?? []).map((p: any) => p.id);
  const incLatest: Record<string, any> = {};
  for (const ev of incEvRows ?? []) {
    if (!incLatest[ev.pr_id]) incLatest[ev.pr_id] = ev;
  }
  const incPrIds = Object.keys(incLatest).filter((pid) => incLatest[pid].status === "returned");

  // ── ชุดที่ 2 (พึ่งผลชุดแรก): หลักฐานของใบที่จ่ายแล้ว + PR ของใบตีกลับ — ยิงพร้อมกัน ──
  const [{ data: paidEvRows }, { data: incPRs }] = await Promise.all([
    paidIds.length > 0
      ? (supabase as any)
          .from("payment_evidences")
          .select("pr_id, close_status, payment_channel, review_note, submitted_at")
          .in("pr_id", paidIds)
          .order("submitted_at", { ascending: false })
      : Promise.resolve({ data: [] }),
    incPrIds.length > 0
      ? (supabase as any)
          .from("purchase_requisitions")
          .select("id, pr_number, title, total_amount, actual_amount, branch_id, status, profiles!requester_id(full_name)")
          .in("id", incPrIds)
      : Promise.resolve({ data: [] }),
  ]);

  const paidEvMap: Record<string, any> = {};
  for (const ev of paidEvRows ?? []) {
    if (!paidEvMap[ev.pr_id]) paidEvMap[ev.pr_id] = ev;
  }

  // ใบที่จ่ายแล้ว — สถานะเอกสารตามที่ บช. เลือกตอนจ่าย (สมบูรณ์ / จ่ายแล้วแต่ค้างเอกสาร)
  const paidDocs: DocRow[] = (paidPRs ?? []).map((pr: any) => {
    const ev = paidEvMap[pr.id] ?? null;
    const isIncomplete = ev?.close_status === "incomplete";
    return {
      id: pr.id,
      pr_number: pr.pr_number,
      title: pr.title,
      amount: pr.actual_amount ?? pr.total_amount ?? 0,
      branch_code: pr.branch_id ? (branchCode[pr.branch_id] ?? "—") : "—",
      requester_name: pr.profiles?.full_name ?? "—",
      date: pr.finance_action_at ?? null,
      payment_channel: ev?.payment_channel ?? null,
      close_status: isIncomplete ? "incomplete" : "complete",
      review_note: isIncomplete ? (ev?.review_note ?? null) : null,
    };
  });

  // ── (2) เอกสารไม่สมบูรณ์ = ถูก บช./การเงินตีกลับ รอพนักงานแก้ไข ──────────────
  const incompleteDocs: DocRow[] = (incPRs ?? [])
    .filter((pr: any) => ["approved", "converted"].includes(pr.status)) // ยังรอแก้ไข ไม่ใช่จ่ายแล้ว
    .map((pr: any) => {
      const ev = incLatest[pr.id];
      return {
        id: pr.id,
        pr_number: pr.pr_number,
        title: pr.title,
        amount: pr.actual_amount ?? pr.total_amount ?? 0,
        branch_code: pr.branch_id ? (branchCode[pr.branch_id] ?? "—") : "—",
        requester_name: pr.profiles?.full_name ?? "—",
        date: ev?.reviewed_at ?? ev?.submitted_at ?? null,
        payment_channel: ev?.payment_channel ?? null,
        close_status: "incomplete",
        review_note: ev?.review_note ?? null,
      };
    });

  const docs: DocRow[] = [...paidDocs, ...incompleteDocs];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100">
          <FileCheck2 size={20} className="text-slate-600" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-slate-800">งานเอกสาร (สมบูรณ์ / ไม่สมบูรณ์)</h1>
          <p className="text-sm text-slate-500">
            เอกสารที่จ่ายแล้ว และเอกสารไม่สมบูรณ์ที่ถูกตีกลับให้แก้ไข — ฝ่ายการเงินตรวจสอบได้
          </p>
        </div>
      </div>

      <FinanceDocumentsList docs={docs} />
    </div>
  );
}
