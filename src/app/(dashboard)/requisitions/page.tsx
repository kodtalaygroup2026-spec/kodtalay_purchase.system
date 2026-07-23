export const dynamic = "force-dynamic";

import { createClient } from "@/lib/supabase/server";
import { RequisitionList, type PRRow } from "@/components/pr/RequisitionList";
import Link from "next/link";
import { Plus } from "lucide-react";

interface PageProps {
  searchParams: Promise<{ step?: string }>;
}

export default async function RequisitionsPage({ searchParams }: PageProps) {
  const supabase = await createClient();
  const { step } = await searchParams;
  const initialStep = step !== undefined ? parseInt(step, 10) : null;

  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user?.id ?? "")
    .single();

  // admin / manager เห็นทุก PR — role อื่นเห็นเฉพาะของตัวเอง
  const isPrivileged = profile?.role === "admin" || profile?.role === "manager";

  let query = (supabase as any)
    .from("purchase_requisitions")
    .select(
      `id, pr_number, title, status, total_amount, created_at, needed_by, is_urgent,
       profiles!requester_id(full_name),
       branches!branch_id(code),
       purchase_orders(id, po_number, status, total_amount, vendor_name)`
    )
    .order("created_at", { ascending: false });

  if (!isPrivileged) {
    query = query.eq("requester_id", user?.id ?? "");
  }

  const { data: prs } = await query;

  // ── ตรวจว่า PR ไหนถูกฝ่ายบัญชี (บช.) ตีกลับให้แก้ก่อนตั้งจ่าย ──────────────
  // เกณฑ์: หลักฐานฉบับล่าสุดของใบนั้นมีสถานะ 'returned' (ยังไม่ได้ส่งแก้กลับเข้าไป)
  // ใช้แยกการ์ด "งานตีกลับ" ออกจาก "แนบบิล + รับของ" และโชว์ป้ายเตือนในตาราง
  const prIds = (prs ?? []).map((pr: any) => pr.id as string);
  const prStatusById: Record<string, string> = Object.fromEntries(
    (prs ?? []).map((pr: any) => [pr.id, pr.status])
  );
  const returnedPrIds = new Set<string>();
  // ใบที่จ่ายแล้วแต่เอกสารตัวจริงยังไม่จบ — แยกว่า "ยังไม่ครบ" กับ "ส่งแก้แล้วรอ บช. ตรวจ"
  const docsStateByPr = new Map<string, "incomplete" | "fix_review">();
  if (prIds.length > 0) {
    const { data: evidenceRows } = await (supabase as any)
      .from("payment_evidences")
      .select("pr_id, status, close_status, submitted_at")
      .in("pr_id", prIds)
      .order("submitted_at", { ascending: false });

    const latestByPr = new Map<string, any>();
    for (const ev of (evidenceRows ?? []) as any[]) {
      if (!latestByPr.has(ev.pr_id)) latestByPr.set(ev.pr_id, ev);
    }
    for (const [prId, ev] of latestByPr) {
      if (ev.status === "returned") returnedPrIds.add(prId);
      if (prStatusById[prId] === "paid") {
        if (ev.close_status === "incomplete") docsStateByPr.set(prId, "incomplete");
        else if (ev.close_status === "fixed") docsStateByPr.set(prId, "fix_review");
      }
    }
  }

  const prList: PRRow[] = (prs ?? []).map((pr: any) => ({
    id: pr.id,
    pr_number: pr.pr_number,
    branch_code: pr.branches?.code ?? null,
    title: pr.title,
    status: pr.status,
    total_amount: pr.total_amount,
    created_at: pr.created_at,
    needed_by: pr.needed_by ?? null,
    is_urgent: pr.is_urgent ?? false,
    payment_returned: returnedPrIds.has(pr.id),
    docs_state: docsStateByPr.get(pr.id) ?? null,
    profiles: pr.profiles ?? null,
    purchase_orders: pr.purchase_orders ?? [],
  }));

  const stepLabels = ["ใบขอซื้อ", "รออนุมัติ", "ดำเนินการ"];

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-800">งานของฉัน</h1>
          <p className="text-sm text-slate-500">
            {initialStep !== null && stepLabels[initialStep]
              ? `กรอง: ${stepLabels[initialStep]}`
              : "รายการใบขอซื้อทั้งหมด — คลิกแถวเพื่อดูรายละเอียด"}
          </p>
        </div>
        <Link
          href="/requisitions/new"
          className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-blue-700"
        >
          <Plus size={16} />
          สร้าง PR
        </Link>
      </div>

      {prList.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white py-16 text-center">
          <p className="text-slate-500">ยังไม่มีใบขอซื้อ</p>
          <Link
            href="/requisitions/new"
            className="mt-3 inline-flex items-center gap-1 text-sm text-blue-600 hover:underline"
          >
            <Plus size={14} /> สร้างใบขอซื้อแรก
          </Link>
        </div>
      ) : (
        <RequisitionList prs={prList} initialStep={Number.isFinite(initialStep) ? initialStep : null} />
      )}
    </div>
  );
}
