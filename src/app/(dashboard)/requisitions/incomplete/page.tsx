export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { AlertTriangle, FileStack, FileCheck2, FileText } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/utils/format";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { IncompleteDocsList, type IncompleteDoc } from "@/components/evidence/IncompleteDocsList";
import type { PrStatus } from "@/types/database";

export default async function MyDocumentsPage() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // ── ดึงเฉพาะของตัวเองเท่านั้น (ล็อกด้วย requester_id / submitted_by) ────────
  const [{ data: myPRs }, { data: myEvidences }] = await Promise.all([
    (supabase as any)
      .from("purchase_requisitions")
      .select("id, pr_number, title, status, total_amount, actual_amount, created_at, finance_action_at")
      .eq("requester_id", user.id)
      .order("created_at", { ascending: false })
      .limit(300),
    (supabase as any)
      .from("payment_evidences")
      .select("id, pr_id, status, close_status, review_note, payment_channel, submitted_at")
      .eq("submitted_by", user.id)
      .order("submitted_at", { ascending: false }),
  ]);

  const prList = (myPRs ?? []) as any[];

  // หลักฐานฉบับล่าสุดของแต่ละใบ
  const latestEvByPr: Record<string, any> = {};
  for (const ev of myEvidences ?? []) {
    if (!latestEvByPr[ev.pr_id]) latestEvByPr[ev.pr_id] = ev;
  }

  // ── สถานะเอกสารของแต่ละใบ ───────────────────────────────────────────────────
  // incomplete_fix   = ถูกตีกลับ รอแก้ไขแล้วส่งใหม่
  // incomplete_docs  = จ่ายแล้วแต่ค้างเอกสารตัวจริง
  // complete         = จ่ายแล้ว เอกสารครบ
  // in_progress      = ยังอยู่ระหว่างขั้นตอน (ร่าง/รออนุมัติ/รอจ่าย ฯลฯ)
  function docStateOf(pr: any): "complete" | "incomplete_fix" | "incomplete_docs" | "in_progress" {
    const ev = latestEvByPr[pr.id] ?? null;
    if (pr.status === "paid") {
      return ev?.close_status === "incomplete" ? "incomplete_docs" : "complete";
    }
    if (
      ev?.status === "returned" &&
      ev?.close_status === "incomplete" &&
      ["approved", "converted"].includes(pr.status)
    ) {
      return "incomplete_fix";
    }
    return "in_progress";
  }

  const docStates: Record<string, ReturnType<typeof docStateOf>> = {};
  for (const pr of prList) docStates[pr.id] = docStateOf(pr);

  const totalCount = prList.length;
  const completeCount = prList.filter((pr) => docStates[pr.id] === "complete").length;
  const incompleteCount = prList.filter(
    (pr) => docStates[pr.id] === "incomplete_fix" || docStates[pr.id] === "incomplete_docs"
  ).length;

  // ── รายการที่ต้องจัดการ (ส่งให้ IncompleteDocsList เดิม) ────────────────────
  const incompleteDocs: IncompleteDoc[] = prList
    .filter((pr) => docStates[pr.id] === "incomplete_fix" || docStates[pr.id] === "incomplete_docs")
    .map((pr) => {
      const ev = latestEvByPr[pr.id];
      return {
        id: pr.id,
        pr_number: pr.pr_number,
        title: pr.title,
        amount: pr.actual_amount ?? pr.total_amount ?? 0,
        evidence_id: ev.id,
        paid_at: pr.finance_action_at ?? null,
        review_note: ev?.review_note ?? null,
        kind: docStates[pr.id] === "incomplete_fix" ? "returned" : "awaiting_docs",
        payment_channel: (ev?.payment_channel ?? null) as "company" | "petty_cash" | null,
      };
    });

  const STAT_CARDS = [
    {
      label: "เอกสารทั้งหมด",
      sub: "ที่เคยสร้าง/ส่งทั้งหมด",
      count: totalCount,
      icon: FileStack,
      iconBg: "bg-blue-100",
      iconColor: "text-blue-600",
      countColor: "text-slate-800",
    },
    {
      label: "เอกสารสมบูรณ์",
      sub: "จ่ายแล้ว เอกสารครบ",
      count: completeCount,
      icon: FileCheck2,
      iconBg: "bg-green-100",
      iconColor: "text-green-600",
      countColor: "text-green-600",
    },
    {
      label: "เอกสารไม่สมบูรณ์",
      sub: "ตีกลับ / ค้างเอกสาร",
      count: incompleteCount,
      icon: AlertTriangle,
      iconBg: "bg-amber-100",
      iconColor: "text-amber-600",
      countColor: "text-amber-600",
    },
  ];

  const DOC_PILL: Record<string, { label: string; cls: string }> = {
    complete:        { label: "สมบูรณ์",     cls: "bg-green-100 text-green-700" },
    incomplete_fix:  { label: "ตีกลับ",      cls: "bg-orange-100 text-orange-700" },
    incomplete_docs: { label: "ค้างเอกสาร",  cls: "bg-amber-100 text-amber-700" },
    in_progress:     { label: "—",           cls: "text-slate-300" },
  };

  return (
    <div className="space-y-6">
      {/* ── หัวเรื่อง ─────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100">
          <FileText size={20} className="text-blue-600" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-slate-800">งานเอกสารของฉัน</h1>
          <p className="text-sm text-slate-500">
            สรุปและประวัติใบสั่งซื้อที่คุณสร้างทั้งหมด — จัดการเอกสารที่ไม่สมบูรณ์ได้จากหน้านี้
          </p>
        </div>
      </div>

      {/* ── การ์ดสรุปตัวเลข ───────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {STAT_CARDS.map((card) => (
          <div key={card.label} className="flex items-center gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${card.iconBg}`}>
              <card.icon size={22} className={card.iconColor} />
            </div>
            <div className="min-w-0">
              <p className={`text-2xl font-bold leading-none ${card.countColor}`}>{card.count}</p>
              <p className="mt-1 truncate text-sm font-medium text-slate-600">{card.label}</p>
              <p className="truncate text-[11px] text-slate-400">{card.sub}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ── รายการที่ต้องจัดการ (ตีกลับ / ค้างเอกสาร) ─────────────────────── */}
      {incompleteDocs.length > 0 && (
        <div className="space-y-3">
          <h2 className="flex items-center gap-2 text-sm font-bold text-slate-700">
            <AlertTriangle size={15} className="text-amber-500" />
            ต้องจัดการ ({incompleteDocs.length})
          </h2>
          <IncompleteDocsList docs={incompleteDocs} currentUserId={user.id} />
        </div>
      )}

      {/* ── ประวัติเอกสารทั้งหมดของฉัน ────────────────────────────────────── */}
      <div className="space-y-3">
        <h2 className="flex items-center gap-2 text-sm font-bold text-slate-700">
          <FileStack size={15} className="text-slate-400" />
          ประวัติเอกสารทั้งหมด ({totalCount})
        </h2>

        {prList.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-white py-16 text-center">
            <p className="text-sm text-slate-400">ยังไม่เคยสร้างใบสั่งซื้อ</p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="border-b border-slate-100 bg-slate-50">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium text-slate-500">เลขที่ PR</th>
                    <th className="px-4 py-3 text-left font-medium text-slate-500">ชื่อรายการ</th>
                    <th className="px-4 py-3 text-left font-medium text-slate-500 whitespace-nowrap">วันที่สร้าง</th>
                    <th className="px-4 py-3 text-left font-medium text-slate-500">สถานะ</th>
                    <th className="px-4 py-3 text-left font-medium text-slate-500">เอกสาร</th>
                    <th className="px-4 py-3 text-right font-medium text-slate-500 whitespace-nowrap">ยอดเงิน</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {prList.map((pr) => {
                    const pill = DOC_PILL[docStates[pr.id]];
                    return (
                      <tr key={pr.id} className="hover:bg-slate-50">
                        <td className="px-4 py-3">
                          <Link
                            href={`/requisitions/${pr.id}`}
                            className="font-mono text-xs font-bold text-blue-600 hover:underline"
                          >
                            {pr.pr_number}
                          </Link>
                        </td>
                        <td className="px-4 py-3 max-w-[240px]">
                          <span className="block truncate font-medium text-slate-800">{pr.title}</span>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-xs text-slate-500">
                          {formatDate(pr.created_at)}
                        </td>
                        <td className="px-4 py-3">
                          <StatusBadge kind="pr" status={pr.status as PrStatus} />
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          {docStates[pr.id] === "in_progress" ? (
                            <span className="text-xs text-slate-300">—</span>
                          ) : (
                            <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${pill.cls}`}>
                              {pill.label}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right font-semibold text-slate-800 whitespace-nowrap">
                          {formatCurrency(pr.actual_amount ?? pr.total_amount ?? 0)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
