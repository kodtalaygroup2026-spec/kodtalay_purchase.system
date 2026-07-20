export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { formatDateTime } from "@/lib/utils/format";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { PRApprovalPanel } from "@/components/pr/PRApprovalPanel";
import { PRAttachmentsSection } from "@/components/pr/PRAttachmentsSection";
import { BranchBadge } from "@/components/shared/BranchBadge";
import { PRItemsDropdown } from "@/components/pr/PRItemsDropdown";
import { EvidenceSubmissionSection } from "@/components/evidence/EvidenceSubmissionSection";
import { EvidenceDetailSection } from "@/components/evidence/EvidenceDetailSection";
import Link from "next/link";
import {
  ArrowLeft, Clock, CheckCircle2, XCircle, Send, X, FileText,
  Edit, Plus, Pencil, Paperclip, ClipboardCheck, Banknote, RotateCcw, FileCheck2, Lock, ArrowDown,
} from "lucide-react";
import type { PrStatus, UserRole } from "@/types/database";

interface PageProps {
  params: Promise<{ id: string }>;
}

// ── Step indicator helpers ─────────────────────────────────────────────────

type StepState = "done" | "current" | "error" | "locked";

const TICKET_STEPS = [
  { label: "ใบขอซื้อ",         sub: "สร้างและส่ง" },
  { label: "อนุมัติการสั่งซื้อ", sub: "ตรวจสอบ" },
  { label: "หลักฐานการซื้อและรับของ", sub: "แนบบิลและยืนยัน" },
];

function computeStepState(
  idx: number,
  prStatus: PrStatus,
  hasEvidence: boolean,
): StepState {
  if (idx === 0) {
    if (["rejected", "cancelled"].includes(prStatus)) return "error";
    if (["submitted", "pending_second_approval", "approved", "converted", "pending_finance", "paid"].includes(prStatus))
      return "done";
    return "current";
  }
  if (idx === 1) {
    if (prStatus === "rejected" || prStatus === "returned") return "error";
    if (["approved", "converted", "pending_finance", "paid"].includes(prStatus)) return "done";
    if (["submitted", "pending_second_approval"].includes(prStatus)) return "current";
    return "locked";
  }
  // idx === 2 — หลักฐานการซื้อและรับของ
  if (hasEvidence) return "done";
  if (["approved", "converted"].includes(prStatus)) return "current";
  return "locked";
}

// ── Page ───────────────────────────────────────────────────────────────────

export default async function RequisitionDetailPage({ params }: PageProps) {
  const { id } = await params;
  const supabase = await createClient();

  const [
    { data: { user } },
    { data: pr },
    { data: items },
  ] = await Promise.all([
    supabase.auth.getUser(),
    (supabase as any)
      .from("purchase_requisitions")
      .select(`*, profiles!requester_id(full_name, email), branches!branch_id(code, name)`)
      .eq("id", id)
      .single(),
    supabase
      .from("pr_items")
      .select(`*, products(name, unit, sku)`)
      .eq("pr_id", id)
      .order("line_no"),
  ]);

  if (!pr) notFound();

  // ── ใบเสนอราคาที่แนบตอนสร้าง PR ────────────────────────────────────────────
  const { data: prAttachments } = await (supabase as any)
    .from("pr_attachments")
    .select("id, file_name, file_url, file_type, file_size")
    .eq("pr_id", id)
    .order("created_at");

  // ── audit log ของ PR นี้ (ใช้เติมไทม์ไลน์ขั้นตอนฝั่งการเงิน) ─────────────────
  const { data: auditLogs } = await (supabase as any)
    .from("audit_logs")
    .select("id, actor_id, action, metadata, created_at")
    .or(`entity_id.eq.${id},metadata->>pr_id.eq.${id}`)
    .order("created_at");

  // ── fetch evidence (ล่าสุด) + item edit logs ─────────────────────────────
  const [{ data: evidenceRows }, { data: itemEditLogs }] = await Promise.all([
    (supabase as any)
      .from("payment_evidences")
      .select("id, account_holder_name, bank_name, bank_account_number, notes, payment_type, payment_channel, submitted_at, status, review_note")
      .eq("pr_id", id)
      .order("submitted_at", { ascending: false }),
    (supabase as any)
      .from("pr_item_edit_logs")
      .select("id, edited_at, edited_by, changes")
      .eq("pr_id", id)
      .order("edited_at"),
  ]);

  // หยิบ evidence ล่าสุด (1 PR อาจมีหลาย row จากการส่งใหม่หลังตีกลับ)
  const latestEvidence: any = (evidenceRows ?? [])[0] ?? null;

  // evidence ที่ยัง active (รอตรวจ/ตรวจแล้วรอจ่าย/จ่ายแล้ว) — ใช้แสดงรายละเอียด read-only
  const activeEvidence: any =
    latestEvidence && ["submitted", "verified", "paid"].includes(latestEvidence.status)
      ? latestEvidence
      : null;

  // evidence ที่ถูกตีกลับล่าสุด — ใช้แสดงแบนเนอร์ + ให้แนบใหม่
  const returnedEvidence: any =
    latestEvidence && latestEvidence.status === "returned" ? latestEvidence : null;

  const paymentEvidence: any = activeEvidence;
  let evidenceFiles: any[] = [];

  if (activeEvidence) {
    const { data: efData } = await (supabase as any)
      .from("evidence_files")
      .select("id, file_name, file_url, evidence_type, file_size")
      .eq("evidence_id", activeEvidence.id)
      .order("evidence_type");
    evidenceFiles = efData ?? [];
  }

  // เคยส่งหลักฐานมาแล้ว (ไม่ว่าสถานะใด) แล้ววนกลับมาที่ฟอร์มแนบใหม่ →
  // ดึงข้อมูล+ไฟล์รอบล่าสุดมาเติมให้เสมอ ไม่ปล่อยฟอร์มว่าง
  const prefillEvidence: any = !activeEvidence ? latestEvidence : null;
  let previousEvidenceFiles: any[] = [];
  if (prefillEvidence) {
    const { data: refData } = await (supabase as any)
      .from("evidence_files")
      .select("id, file_name, file_url, evidence_type, file_size")
      .eq("evidence_id", prefillEvidence.id)
      .order("evidence_type");
    previousEvidenceFiles = refData ?? [];
  }

  // ตีกลับจากฝ่ายการเงิน → แก้ได้เฉพาะส่วนหลักฐาน ส่วนอื่นล็อกอ่านอย่างเดียว
  const isPaymentReturned =
    Boolean(returnedEvidence) && ["approved", "converted"].includes(pr.status as string);

  // ── Audit trail profile IDs (รวม editor ของ item edits ด้วย) ────────────
  const editLogEditorIds = ((itemEditLogs ?? []) as any[]).map((l: any) => l.edited_by).filter(Boolean);
  const auditActorIds = ((auditLogs ?? []) as any[]).map((l: any) => l.actor_id).filter(Boolean);
  const auditIds = [pr.submitted_by, pr.approved_by, pr.rejected_by, pr.cancelled_by, ...editLogEditorIds, ...auditActorIds]
    .filter((v: unknown): v is string => typeof v === "string" && v.length > 0);
  const uniqueIds = [...new Set(auditIds)];

  const [{ data: currentProfile }, { data: auditProfileList }] =
    await Promise.all([
      supabase.from("profiles").select("role, full_name, bank_name, bank_account_number, bank_account_holder_name").eq("id", user?.id ?? "").single(),
      uniqueIds.length > 0
        ? (supabase as any).from("profiles").select("id, full_name").in("id", uniqueIds)
        : Promise.resolve({ data: [] }),
    ]);

  const currentUserRole = currentProfile?.role as UserRole | undefined;
  const isOwner = user?.id === pr.requester_id;
  const requester = pr.profiles as { full_name: string; email: string } | null;

  const nameOf: Record<string, string> = Object.fromEntries(
    ((auditProfileList as { id: string; full_name: string }[] | null) ?? [])
      .map(p => [p.id, p.full_name])
  );

  const hasEvidence = !!paymentEvidence;
  const prStatus = pr.status as PrStatus;

  // apply edit logs ทับราคาใน pr_items เพื่อให้แสดงราคาที่แก้ไขแล้วเสมอ
  let displayItems: any[] = [...(items ?? [])];
  for (const log of (itemEditLogs ?? []) as any[]) {
    const changeMap = new Map(
      ((log.changes ?? []) as any[]).map((c: any) => [c.item_id, c])
    );
    displayItems = displayItems.map((item: any) => {
      const ch = changeMap.get(item.id);
      if (!ch) return item;
      return {
        ...item,
        quantity: ch.quantity_new,
        unit_price: ch.unit_price_new,
        line_total: ch.quantity_new * ch.unit_price_new,
      };
    });
  }

  // ── Activity timeline ─────────────────────────────────────────────────────
  type ItemChange = {
    item_id: string;
    description: string;
    quantity_old: number;
    quantity_new: number;
    unit_price_old: number;
    unit_price_new: number;
  };

  type ActivityEntry = {
    at: string;
    label: string;
    by: string;
    color: "slate" | "blue" | "green" | "red" | "orange" | "amber" | "indigo";
    icon: React.ElementType;
    /** ข้อความที่ผู้ใช้พิมพ์เอง — แสดงในเครื่องหมายคำพูด */
    reason?: string;
    /** คำอธิบายที่ระบบสร้าง — แสดงเป็นข้อความธรรมดา */
    note?: string;
    itemChanges?: ItemChange[];
    /** ลำดับขั้นตอนในกระบวนการ — ใช้ตัดสินเมื่อเวลาบันทึกตรงกัน */
    rank: number;
  };

  const timeline: ActivityEntry[] = [
    {
      at: pr.created_at,
      label: "สร้างใบขอซื้อ",
      by: requester?.full_name ?? requester?.email ?? "—",
      color: "slate",
      icon: FileText,
      rank: 0,
    },
  ];
  if (pr.submitted_at && pr.submitted_by) {
    timeline.push({
      at: pr.submitted_at,
      label: "ส่งขออนุมัติ",
      by: nameOf[pr.submitted_by] ?? "—",
      color: "blue",
      icon: Send,
      rank: 1,
    });
  }
  if (pr.approved_at && pr.approved_by) {
    timeline.push({
      at: pr.approved_at,
      label: "อนุมัติใบขอซื้อ",
      by: nameOf[pr.approved_by] ?? "—",
      color: "green",
      icon: CheckCircle2,
      rank: 2,
    });
  }
  if (pr.rejected_at && pr.rejected_by) {
    timeline.push({
      at: pr.rejected_at,
      label: pr.status === "returned" ? "ตีกลับให้แก้ไขใบขอซื้อ" : "ไม่อนุมัติใบขอซื้อ",
      by: nameOf[pr.rejected_by] ?? "—",
      color: pr.status === "returned" ? "orange" : "red",
      icon: XCircle,
      reason: pr.rejection_reason ?? undefined,
      rank: 2,
    });
  }
  if (pr.cancelled_at && pr.cancelled_by) {
    timeline.push({
      at: pr.cancelled_at,
      label: "ยกเลิกใบขอซื้อ",
      by: nameOf[pr.cancelled_by] ?? "—",
      color: "red",
      icon: X,
      rank: 9,
    });
  }
  for (const log of (itemEditLogs ?? []) as any[]) {
    timeline.push({
      at: log.edited_at,
      label: "แก้ไขรายการสินค้า",
      by: nameOf[log.edited_by] ?? "—",
      color: "amber",
      icon: Pencil,
      itemChanges: (log.changes ?? []) as ItemChange[],
      rank: 3,
    });
  }

  // ── ขั้นตอนฝั่งการเงินจาก audit log (ข้าม pr_* เพราะมีจากคอลัมน์ PR อยู่แล้ว) ──
  for (const log of (auditLogs ?? []) as any[]) {
    const meta = (log.metadata ?? {}) as Record<string, any>;
    const by = nameOf[log.actor_id] ?? "—";
    const channelLabel =
      meta.channel === "petty_cash" ? "จ่ายจากเงินสดย่อย" : "บริษัทเป็นผู้สั่งจ่าย";

    switch (log.action) {
      case "payment_evidence_submitted":
        timeline.push({
          at: log.created_at,
          label: "ส่งบิลให้ฝ่ายการเงินตรวจสอบ",
          by,
          color: "blue",
          icon: Paperclip,
          note:
            meta.payment_type === "self_pay"
              ? "พนักงานสำรองจ่ายไปก่อน — ขอเบิกคืน"
              : "ส่งบิลให้ฝ่ายบัญชีเป็นผู้จ่าย",
          rank: 4,
        });
        break;
      case "payment_verified":
        timeline.push({
          at: log.created_at,
          label: `ฝ่ายการเงินตรวจสอบแล้ว — ${channelLabel}`,
          by,
          color: "indigo",
          icon: ClipboardCheck,
          rank: 5,
        });
        break;
      case "payment_returned":
        timeline.push({
          at: log.created_at,
          label:
            meta.close_status === "incomplete"
              ? "ตีกลับให้แก้ไข — เอกสารไม่สมบูรณ์"
              : "ตีกลับให้แก้ไขหลักฐาน",
          by,
          color: "orange",
          icon: RotateCcw,
          reason: meta.note ?? undefined,
          rank: 6,
        });
        break;
      case "payment_marked_paid":
        timeline.push({
          at: log.created_at,
          label:
            // incomplete = จ่ายจริงแล้วแต่ค้างเอกสาร (พนักงานตามแก้เอกสารต่อ)
            meta.close_status === "incomplete"
              ? `จ่ายเงินแล้ว — ${channelLabel} (เอกสารไม่สมบูรณ์)`
              : `จ่ายเงินแล้ว — ${channelLabel}`,
          by,
          color: meta.close_status === "incomplete" ? "orange" : "green",
          icon: Banknote,
          reason: meta.note ?? undefined,
          rank: 7,
        });
        break;
      case "documents_completed":
        timeline.push({
          at: log.created_at,
          label: "ยืนยันเอกสารครบถ้วน — ปิดงานสมบูรณ์",
          by,
          color: "green",
          icon: FileCheck2,
          rank: 8,
        });
        break;
      case "documents_fixed":
        timeline.push({
          at: log.created_at,
          label: "ส่งเอกสารที่แก้ไขให้การเงินตรวจ",
          by,
          color: "blue",
          icon: Paperclip,
          reason: meta.note ?? undefined,
          rank: 8,
        });
        break;
      case "documents_fix_rejected":
        timeline.push({
          at: log.created_at,
          label: "การเงินตีกลับเอกสารอีกครั้ง",
          by,
          color: "orange",
          icon: RotateCcw,
          reason: meta.note ?? undefined,
          rank: 8,
        });
        break;
      case "payment_cancelled":
        timeline.push({
          at: log.created_at,
          label: "ยกเลิกโดยฝ่ายการเงิน",
          by,
          color: "red",
          icon: X,
          reason: meta.note ?? undefined,
          rank: 9,
        });
        break;
      default:
        break; // pr_created / pr_submitted / pr_approved ... มีอยู่แล้วด้านบน
    }
  }

  // เรียงตามเวลา แล้วใช้ rank ตัดสินเมื่อเวลาบันทึกตรงกัน (เช่น สร้างแล้วส่งทันที)
  timeline.sort((a, b) => {
    const diff = new Date(a.at).getTime() - new Date(b.at).getTime();
    return diff !== 0 ? diff : a.rank - b.rank;
  });

  // สีสื่อความหมาย: เทา=เริ่มต้น · น้ำเงิน=ผู้ขอส่งเรื่อง · เขียว=ผ่าน/สำเร็จ
  // คราม=ฝ่ายการเงินตรวจสอบ · เหลือง=แก้ไข · ส้ม=ตีกลับ · แดง=ยกเลิก/ไม่อนุมัติ
  const colorMap = {
    slate:  { dot: "bg-slate-400",  text: "text-slate-500",  badge: "bg-slate-100 text-slate-600" },
    blue:   { dot: "bg-blue-500",   text: "text-blue-600",   badge: "bg-blue-50 text-blue-700" },
    indigo: { dot: "bg-indigo-500", text: "text-indigo-600", badge: "bg-indigo-50 text-indigo-700" },
    green:  { dot: "bg-green-500",  text: "text-green-600",  badge: "bg-green-50 text-green-700" },
    amber:  { dot: "bg-amber-400",  text: "text-amber-600",  badge: "bg-amber-50 text-amber-700" },
    red:    { dot: "bg-red-500",    text: "text-red-600",    badge: "bg-red-50 text-red-700" },
    orange: { dot: "bg-orange-400", text: "text-orange-600", badge: "bg-orange-50 text-orange-700" },
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="mx-auto max-w-3xl space-y-5">
      {/* Back navigation */}
      <div className="flex items-center gap-2">
        <Link href="/requisitions" className="text-slate-400 hover:text-slate-600">
          <ArrowLeft size={20} />
        </Link>
        <span className="text-sm text-slate-400">ใบขอซื้อ</span>
      </div>

      {/* ── 4-Step ticket indicator ───────────────────────────────────────── */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <p className="mb-3 text-[10px] font-semibold uppercase tracking-widest text-slate-400">
          สถานะการดำเนินการ
        </p>
        <div className="flex items-stretch gap-1.5">
          {TICKET_STEPS.map((step, i) => {
            const state = computeStepState(i, prStatus, hasEvidence);
            const boxCls = {
              done:    "border-green-300 bg-green-50",
              current: "border-blue-400 bg-blue-50 ring-1 ring-blue-200 shadow-sm",
              error:   "border-red-300 bg-red-50",
              locked:  "border-slate-200 bg-slate-50",
            }[state];
            const numCls = {
              done:    "text-green-600",
              current: "text-blue-700 font-extrabold",
              error:   "text-red-600",
              locked:  "text-slate-300",
            }[state];
            const labelCls = {
              done:    "text-green-700",
              current: "text-blue-700",
              error:   "text-red-700",
              locked:  "text-slate-400",
            }[state];
            const lineCls =
              state === "done" ? "bg-green-300" : "bg-slate-200";

            return (
              <>
                <div
                  key={step.label}
                  className={`flex flex-1 flex-col items-center justify-center gap-0.5 rounded-xl border-2 px-2 py-3 text-center min-w-0 ${boxCls}`}
                >
                  <div className={`text-base ${numCls}`}>
                    {state === "done" ? "✓" : state === "error" ? "✕" : i + 1}
                  </div>
                  <div className={`text-xs font-semibold leading-tight ${labelCls}`}>
                    {step.label}
                  </div>
                  <div className="text-[10px] text-slate-400 hidden sm:block">{step.sub}</div>
                  {state === "current" && (
                    <div className="mt-0.5 text-[9px] font-semibold text-blue-500">● ดำเนินการ</div>
                  )}
                </div>
                {i < 2 && (
                  <div className={`self-center h-0.5 w-2 shrink-0 rounded-full ${lineCls}`} />
                )}
              </>
            );
          })}
        </div>
      </div>

      {/* ── Banner เหตุผลตีกลับ / ไม่อนุมัติ ──────────────────────────────── */}
      {(prStatus === "returned" || prStatus === "rejected") && pr.rejection_reason && (
        <div className={`flex items-start gap-3 rounded-xl border px-5 py-4 ${
          prStatus === "returned"
            ? "border-orange-200 bg-orange-50"
            : "border-red-200 bg-red-50"
        }`}>
          <XCircle size={18} className={`mt-0.5 shrink-0 ${prStatus === "returned" ? "text-orange-500" : "text-red-500"}`} />
          <div>
            <p className={`text-sm font-semibold ${prStatus === "returned" ? "text-orange-700" : "text-red-700"}`}>
              {prStatus === "returned" ? "เหตุผลที่ตีกลับ" : "เหตุผลที่ไม่อนุมัติ"}
            </p>
            <p className={`mt-0.5 text-sm ${prStatus === "returned" ? "text-orange-600" : "text-red-600"}`}>
              {pr.rejection_reason}
            </p>
          </div>
        </div>
      )}

      {/* ── PR info + รายการสินค้า (paper เดียวกัน) ─────────────────────── */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">

        {/* Header — compact card style */}
        <div className="px-6 pt-5 pb-4">

          {/* Row 1: status badge + title | branch badge */}
          <div className="mb-1.5 flex items-start justify-between gap-2">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              {returnedEvidence ? (
                <>
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-700">
                    ตีกลับให้แก้ไข
                  </span>
                  {isPaymentReturned && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-500">
                      <Lock size={10} /> แก้ไขได้เฉพาะหลักฐาน
                    </span>
                  )}
                </>
              ) : (
                <StatusBadge kind="pr" status={pr.status as PrStatus} />
              )}
              {pr.is_urgent && (
                <span className="rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-semibold text-red-600">
                  ด่วน
                </span>
              )}
              <h2 className="text-lg font-bold leading-snug text-slate-800">{pr.title}</h2>
            </div>
            {pr.branches?.code ? (
              <span className="mt-0.5 shrink-0">
                <BranchBadge
                  code={pr.branches.code}
                  label={pr.branches.name ?? pr.branches.code}
                  size="md"
                />
              </span>
            ) : null}
          </div>

          {/* Row 2: โดย name · department · ticket | edit buttons */}
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm text-slate-400">
              โดย{" "}
              <span className="text-slate-600">{requester?.full_name ?? requester?.email ?? "—"}</span>
              {pr.department && <span> · {pr.department}</span>}
              {" · "}
              <span className="font-mono text-xs text-slate-500">{pr.pr_number}</span>
            </p>
            <div className="flex shrink-0 items-center gap-2">
              {isPaymentReturned && isOwner && (
                <a
                  href="#evidence-fix"
                  className="flex items-center gap-1.5 rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-medium text-white shadow-sm transition hover:bg-amber-600"
                >
                  <ArrowDown size={13} /> ไปแก้ไขหลักฐาน
                </a>
              )}
              {prStatus === "draft" && isOwner && (
                <Link
                  href={`/requisitions/${pr.id}/edit`}
                  className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white shadow-sm transition hover:bg-blue-700"
                >
                  <Edit size={13} /> แก้ไข
                </Link>
              )}
              {prStatus === "returned" && isOwner && (
                <Link
                  href={`/requisitions/${pr.id}/edit`}
                  className="flex items-center gap-1.5 rounded-lg bg-orange-500 px-3 py-1.5 text-xs font-medium text-white shadow-sm transition hover:bg-orange-600"
                >
                  <Edit size={13} /> แก้ไขและส่งใหม่
                </Link>
              )}
              {prStatus === "rejected" && isOwner && (
                <Link
                  href="/requisitions/new"
                  className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white shadow-sm transition hover:bg-blue-700"
                >
                  <Plus size={13} /> สร้าง PR ใหม่
                </Link>
              )}
            </div>
          </div>

          {/* Note only (dates removed) */}
          {pr.note && (
            <div className="mt-3 border-t border-slate-100 pt-3">
              <p className="text-xs text-slate-400">เหตุผลในการสั่งซื้อ</p>
              <p className="text-sm font-medium text-slate-700">{pr.note}</p>
            </div>
          )}
        </div>

        {/* รายการสินค้า — dropdown + edit เฉพาะขั้นตอน 3 */}
        <PRItemsDropdown
          items={displayItems}
          totalAmount={pr.total_amount}
          collapsible={["approved", "converted", "pending_finance", "paid"].includes(prStatus)}
          editable={["approved", "converted"].includes(prStatus) && isOwner && !isPaymentReturned}
          prId={pr.id}
          currentUserId={user?.id ?? ""}
        />
      </div>

      {/* ── ใบเสนอราคา (แนบตอนสร้าง PR) ──────────────────────────────────── */}
      <PRAttachmentsSection attachments={(prAttachments ?? []) as any} locked={isPaymentReturned} />

      {/* ── PR Approval Panel ────────────────────────────────────────────── */}
      <PRApprovalPanel
        pr={{
          id: pr.id,
          pr_number: pr.pr_number,
          title: pr.title,
          total_amount: pr.total_amount,
          status: pr.status as PrStatus,
          requester_id: pr.requester_id,
          branch_name: pr.branches?.name ?? pr.branches?.code ?? null,
        }}
        currentUserId={user?.id ?? ""}
        currentUserRole={currentUserRole}
      />

      {/* ── Evidence divider ─────────────────────────────────────────────── */}
      {(["approved", "converted"].includes(prStatus) || hasEvidence) && (
        <div className="flex items-center gap-3 py-1">
          <div className="flex-1 border-t border-slate-200" />
          <span className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">
            หลักฐานการซื้อและรับของ
          </span>
          <div className="flex-1 border-t border-slate-200" />
        </div>
      )}

      {/* ── แบนเนอร์: การจ่ายถูกตีกลับ ─────────────────────────────────── */}
      {returnedEvidence && isOwner && ["approved", "converted"].includes(prStatus) && (
        <div id="evidence-fix" className="flex scroll-mt-24 items-start gap-3 rounded-xl border border-amber-300 bg-amber-50 px-5 py-4">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-100">
            <span className="text-sm">↩️</span>
          </div>
          <div>
            <p className="text-sm font-semibold text-amber-800">การจ่ายถูกตีกลับจากฝ่ายการเงิน</p>
            {returnedEvidence.review_note && (
              <p className="mt-0.5 text-sm text-amber-700">
                เหตุผล: {returnedEvidence.review_note}
              </p>
            )}
            <p className="mt-1 text-xs text-amber-600">กรุณาแก้ไขข้อมูล/ไฟล์แล้วส่งใหม่อีกครั้ง</p>
          </div>
        </div>
      )}

      {/* ── Evidence Submission (ยังไม่ส่ง + เป็นเจ้าของ) ───────────────── */}
      {["approved", "converted"].includes(prStatus) && !hasEvidence && isOwner && (
        <EvidenceSubmissionSection
          poId={null}
          prId={pr.id}
          prBankName={(pr as any).bank_name ?? null}
          prBankAccount={(pr as any).bank_account_number ?? null}
          currentUserId={user?.id ?? ""}
          originalAmount={pr.total_amount}
          profileBankName={(currentProfile as any)?.bank_name ?? null}
          profileBankAccount={(currentProfile as any)?.bank_account_number ?? null}
          profileHolderName={(currentProfile as any)?.bank_account_holder_name ?? currentProfile?.full_name ?? null}
          previousFiles={previousEvidenceFiles}
          previousData={
            prefillEvidence
              ? {
                  account_holder_name: prefillEvidence.account_holder_name ?? null,
                  bank_name: prefillEvidence.bank_name ?? null,
                  bank_account_number: prefillEvidence.bank_account_number ?? null,
                  payment_type: prefillEvidence.payment_type ?? null,
                  notes: prefillEvidence.notes ?? null,
                }
              : null
          }
        />
      )}

      {/* รอผู้สั่งซื้อแนบหลักฐาน */}
      {["approved", "converted"].includes(prStatus) && !hasEvidence && !isOwner && (
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-6 py-8 text-center">
          <p className="text-sm font-medium text-slate-500">รอผู้สั่งซื้อแนบหลักฐานการรับของ</p>
          <p className="mt-1 text-xs text-slate-400">ผู้สั่งซื้อจะต้องแนบบิลและข้อมูลผู้รับเงินก่อนดำเนินการต่อ</p>
        </div>
      )}

      {/* แจ้งสถานะ pending_finance */}
      {prStatus === "pending_finance" && (
        <div className="flex items-center gap-3 rounded-xl border border-purple-200 bg-purple-50 px-5 py-4">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-purple-100">
            <span className="text-sm">📋</span>
          </div>
          <div>
            <p className="text-sm font-semibold text-purple-800">ส่งหลักฐานแล้ว — รอฝ่ายการเงินตรวจสอบ</p>
            <p className="text-xs text-purple-600">ฝ่ายการเงินจะดำเนินการตรวจสอบและจัดชุดจ่ายต่อไป</p>
          </div>
        </div>
      )}

      {/* แจ้งสถานะ paid */}
      {prStatus === "paid" && (
        <div className="flex items-center gap-3 rounded-xl border border-teal-200 bg-teal-50 px-5 py-4">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-teal-100">
            <span className="text-sm">✅</span>
          </div>
          <div>
            <p className="text-sm font-semibold text-teal-800">จ่ายเงินแล้ว</p>
            <p className="text-xs text-teal-600">ฝ่ายการเงินยืนยันการจ่ายเรียบร้อยแล้ว</p>
          </div>
        </div>
      )}

      {/* ── Evidence Detail (ส่งแล้ว — read-only) ───────────────────────── */}
      {hasEvidence && paymentEvidence && (
        <EvidenceDetailSection
          evidence={paymentEvidence}
          files={evidenceFiles}
        />
      )}

      {/* ── Activity timeline — ล่างสุดเสมอ ─────────────────────────────── */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-center gap-2">
          <Clock size={16} className="text-slate-400" />
          <h3 className="font-semibold text-slate-700">ประวัติการดำเนินการ PR</h3>
        </div>
        <ol className="relative ml-2 space-y-5 border-l border-slate-200">
          {timeline.map((entry, i) => {
            const c = colorMap[entry.color];
            const Icon = entry.icon;
            return (
              <li key={i} className="ml-5">
                <span
                  className={`absolute -left-[9px] flex h-4 w-4 items-center justify-center rounded-full ${c.dot}`}
                />
                <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                  <span className={`text-sm font-semibold ${c.text}`}>
                    <Icon size={13} className="mr-1 inline-block" />
                    {entry.label}
                  </span>
                  <span className="text-sm text-slate-700">โดย {entry.by}</span>
                  <span className="text-xs text-slate-400">{formatDateTime(entry.at)}</span>
                </div>
                {entry.note && (
                  <p className={`mt-1 rounded-lg border px-3 py-1.5 text-xs ${c.badge}`}>
                    {entry.note}
                  </p>
                )}
                {entry.reason && (
                  <p className={`mt-1 rounded-lg border px-3 py-1.5 text-xs ${c.badge}`}>
                    &ldquo;{entry.reason}&rdquo;
                  </p>
                )}
                {entry.itemChanges && entry.itemChanges.length > 0 && (
                  <ul className="mt-1.5 space-y-1">
                    {entry.itemChanges.map((ch, ci) => (
                      <li key={ci} className={`rounded-lg border px-3 py-1.5 text-xs ${c.badge}`}>
                        <span className="font-medium">{ch.description}</span>
                        {ch.quantity_old !== ch.quantity_new && (
                          <span className="ml-2 text-slate-500">
                            จำนวน: {ch.quantity_old} → <span className="font-semibold">{ch.quantity_new}</span>
                          </span>
                        )}
                        {ch.unit_price_old !== ch.unit_price_new && (
                          <span className="ml-2 text-slate-500">
                            ราคา: ฿{ch.unit_price_old} → <span className="font-semibold">฿{ch.unit_price_new}</span>
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            );
          })}
        </ol>
      </div>

    </div>
  );
}
