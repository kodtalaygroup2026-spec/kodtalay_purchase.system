export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { formatCurrency, formatDateTime } from "@/lib/utils/format";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { PRApprovalPanel } from "@/components/pr/PRApprovalPanel";
import { POCreationSection } from "@/components/po/POCreationSection";
import { PODetailSection } from "@/components/po/PODetailSection";
import { EvidenceSubmissionSection } from "@/components/evidence/EvidenceSubmissionSection";
import { EvidenceDetailSection } from "@/components/evidence/EvidenceDetailSection";
import Link from "next/link";
import {
  ArrowLeft, Clock, CheckCircle2, XCircle, Send, X, FileText,
  Edit, Plus,
} from "lucide-react";
import type { PrStatus, PoStatus, UserRole } from "@/types/database";

interface PageProps {
  params: Promise<{ id: string }>;
}

// ── Step indicator helpers ─────────────────────────────────────────────────

type StepState = "done" | "current" | "error" | "locked";

const TICKET_STEPS = [
  { label: "ใบขอซื้อ", sub: "สร้างและส่ง" },
  { label: "อนุมัติ PR", sub: "ตรวจสอบ" },
  { label: "ใบสั่งซื้อ", sub: "สร้าง PO" },
  { label: "อนุมัติ PO", sub: "ยืนยัน" },
  { label: "แนบหลักฐาน", sub: "ยืนยันรับของ" },
];

function computeStepState(
  idx: number,
  prStatus: PrStatus,
  hasPO: boolean,
  poStatus?: PoStatus,
  hasEvidence?: boolean,
): StepState {
  if (idx === 0) {
    if (["rejected", "cancelled"].includes(prStatus)) return "error";
    if (["submitted", "pending_second_approval", "approved", "converted"].includes(prStatus) || hasPO)
      return "done";
    return "current";
  }
  if (idx === 1) {
    if (prStatus === "rejected" || prStatus === "returned") return "error";
    if (["approved", "converted"].includes(prStatus) || hasPO) return "done";
    if (["submitted", "pending_second_approval"].includes(prStatus)) return "current";
    return "locked";
  }
  if (idx === 2) {
    if (hasPO) return "done";
    if (prStatus === "approved") return "current";
    return "locked";
  }
  if (idx === 3) {
    if (poStatus === "approved") return "done";
    if (hasPO) return "current";
    return "locked";
  }
  // idx === 4 — แนบหลักฐาน
  if (hasEvidence) return "done";
  if (poStatus === "approved") return "current";
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
      .select(`*, profiles!requester_id(full_name, email)`)
      .eq("id", id)
      .single(),
    supabase
      .from("pr_items")
      .select(`*, products(name, unit, sku)`)
      .eq("pr_id", id)
      .order("line_no"),
  ]);

  if (!pr) notFound();

  // Audit trail profile IDs
  const auditIds = [pr.submitted_by, pr.approved_by, pr.rejected_by, pr.cancelled_by]
    .filter((v: unknown): v is string => typeof v === "string" && v.length > 0);
  const uniqueIds = [...new Set(auditIds)];

  const [{ data: currentProfile }, { data: auditProfileList }, { data: linkedPOs }] =
    await Promise.all([
      supabase.from("profiles").select("role, full_name").eq("id", user?.id ?? "").single(),
      uniqueIds.length > 0
        ? (supabase as any).from("profiles").select("id, full_name").in("id", uniqueIds)
        : Promise.resolve({ data: [] }),
      (supabase as any)
        .from("purchase_orders")
        .select("id, po_number, status, total_amount, created_at")
        .eq("pr_id", id)
        .order("created_at"),
    ]);

  // ── Conditionally fetch PO detail if PO exists ────────────────────────────
  let poDetail: any = null;
  let poItems: any[] = [];
  let poAttachments: any[] = [];
  let poBills: any[] = [];
  let paymentEvidence: any = null;
  let evidenceFiles: any[] = [];

  if (linkedPOs && (linkedPOs as any[]).length > 0) {
    const primaryPoId = (linkedPOs as any[])[0].id;
    const [{ data: poRecord }, { data: poItemsData }, { data: poAttachmentsData }, { data: poBillsData }, { data: evidenceRecord }] =
      await Promise.all([
        (supabase as any)
          .from("purchase_orders")
          .select(
            "id, po_number, status, vendor_name, order_date, note, subtotal, vat_rate, vat_amount, total_amount, pr_total_amount, submitted_at, approved_at, cancelled_at, created_by, created_at"
          )
          .eq("id", primaryPoId)
          .single(),
        supabase
          .from("po_items")
          .select("id, line_no, description, quantity, unit, unit_price, pr_unit_price, line_total, received_qty")
          .eq("po_id", primaryPoId)
          .order("line_no"),
        (supabase as any)
          .from("po_attachments")
          .select("id, file_name, file_url, file_type, file_size")
          .eq("po_id", primaryPoId)
          .order("created_at"),
        (supabase as any)
          .from("purchase_bills")
          .select("id, bill_number, bill_date, bill_amount, vendor_name, notes, created_at")
          .eq("po_id", primaryPoId)
          .order("created_at"),
        (supabase as any)
          .from("payment_evidences")
          .select("id, account_holder_name, bank_name, bank_account_number, notes, submitted_at")
          .eq("po_id", primaryPoId)
          .maybeSingle(),
      ]);
    poDetail = poRecord;
    poItems = poItemsData ?? [];
    poAttachments = poAttachmentsData ?? [];
    poBills = poBillsData ?? [];
    paymentEvidence = evidenceRecord ?? null;

    if (paymentEvidence) {
      const { data: efData } = await (supabase as any)
        .from("evidence_files")
        .select("id, file_name, file_url, evidence_type, file_size")
        .eq("evidence_id", paymentEvidence.id)
        .order("evidence_type");
      evidenceFiles = efData ?? [];
    }
  }

  const currentUserRole = currentProfile?.role as UserRole | undefined;
  const isOwner = user?.id === pr.requester_id;
  const requester = pr.profiles as { full_name: string; email: string } | null;

  const nameOf: Record<string, string> = Object.fromEntries(
    ((auditProfileList as { id: string; full_name: string }[] | null) ?? [])
      .map(p => [p.id, p.full_name])
  );

  // ── PO section logic ──────────────────────────────────────────────────────
  const hasPO = !!poDetail;
  const hasEvidence = !!paymentEvidence;
  const prStatus = pr.status as PrStatus;
  const poStatus = poDetail?.status as PoStatus | undefined;

  const canCreatePO =
    prStatus === "approved" &&
    !hasPO &&
    (user?.id === pr.requester_id ||
      currentUserRole === "admin" ||
      currentUserRole === "purchaser");

  const prItemsForPO = ((items ?? []) as any[]).map((it: any) => ({
    id: it.id,
    line_no: it.line_no ?? 0,
    description: it.description,
    unit: it.unit,
    quantity: Number(it.quantity),
    pr_unit_price: Number(it.unit_price),
  }));

  // ── Activity timeline ─────────────────────────────────────────────────────
  type ActivityEntry = {
    at: string;
    label: string;
    by: string;
    color: "slate" | "blue" | "green" | "red" | "orange";
    icon: React.ElementType;
  };

  const timeline: ActivityEntry[] = [
    {
      at: pr.created_at,
      label: "สร้างใบขอซื้อ",
      by: requester?.full_name ?? requester?.email ?? "—",
      color: "slate",
      icon: FileText,
    },
  ];
  if (pr.submitted_at && pr.submitted_by) {
    timeline.push({
      at: pr.submitted_at,
      label: "ส่งขออนุมัติ",
      by: nameOf[pr.submitted_by] ?? "—",
      color: "blue",
      icon: Send,
    });
  }
  if (pr.approved_at && pr.approved_by) {
    timeline.push({
      at: pr.approved_at,
      label: "อนุมัติ",
      by: nameOf[pr.approved_by] ?? "—",
      color: "green",
      icon: CheckCircle2,
    });
  }
  if (pr.rejected_at && pr.rejected_by) {
    timeline.push({
      at: pr.rejected_at,
      label: pr.status === "returned" ? "ตีกลับ" : "ไม่อนุมัติ",
      by: nameOf[pr.rejected_by] ?? "—",
      color: pr.status === "returned" ? "orange" : "red",
      icon: XCircle,
    });
  }
  if (pr.cancelled_at && pr.cancelled_by) {
    timeline.push({
      at: pr.cancelled_at,
      label: "ยกเลิก",
      by: nameOf[pr.cancelled_by] ?? "—",
      color: "red",
      icon: X,
    });
  }
  timeline.sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());

  const colorMap = {
    slate:  { dot: "bg-slate-400",  text: "text-slate-500",  badge: "bg-slate-100 text-slate-600" },
    blue:   { dot: "bg-blue-500",   text: "text-blue-600",   badge: "bg-blue-50 text-blue-700" },
    green:  { dot: "bg-green-500",  text: "text-green-600",  badge: "bg-green-50 text-green-700" },
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
            const state = computeStepState(i, prStatus, hasPO, poStatus, hasEvidence);
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
                {i < 4 && (
                  <div className={`self-center h-0.5 w-2 shrink-0 rounded-full ${lineCls}`} />
                )}
              </>
            );
          })}
        </div>
      </div>

      {/* ── PR info card ──────────────────────────────────────────────────── */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <StatusBadge kind="pr" status={pr.status as PrStatus} />
            {pr.is_urgent && (
              <span className="rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-semibold text-red-600">
                ด่วน
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {/* ปุ่มแก้ไข — แสดงเมื่อตีกลับและเป็นเจ้าของ */}
            {prStatus === "returned" && isOwner && (
              <Link
                href={`/requisitions/${pr.id}/edit`}
                className="flex items-center gap-1.5 rounded-lg bg-orange-500 px-3 py-1.5 text-xs font-medium text-white shadow-sm transition hover:bg-orange-600"
              >
                <Edit size={13} /> แก้ไขและส่งใหม่
              </Link>
            )}
            {/* ปุ่มสร้างใหม่ — แสดงเมื่อ rejected (ไม่อนุมัติถาวร) และเป็นเจ้าของ */}
            {prStatus === "rejected" && isOwner && (
              <Link
                href="/requisitions/new"
                className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white shadow-sm transition hover:bg-blue-700"
              >
                <Plus size={13} /> สร้าง PR ใหม่
              </Link>
            )}
            <span className="rounded-md bg-slate-100 px-3 py-1 font-mono text-sm font-bold text-slate-700 tracking-wider border border-slate-200">
              {pr.pr_number}
            </span>
          </div>
        </div>
        <h2 className="mb-4 text-xl font-bold text-slate-800">{pr.title}</h2>
        <div className="border-t border-slate-100 pt-4">
          <div className="grid grid-cols-2 gap-x-8 gap-y-3 text-sm">
            <div>
              <p className="text-slate-500">ผู้ขอ</p>
              <p className="font-medium text-slate-800">
                {requester?.full_name ?? requester?.email ?? "—"}
              </p>
            </div>
            <div>
              <p className="text-slate-500">แผนก</p>
              <p className="font-medium text-slate-800">{pr.department ?? "—"}</p>
            </div>
            <div>
              <p className="text-slate-500">วันที่สร้าง</p>
              <p className="font-medium text-slate-800">{formatDateTime(pr.created_at)}</p>
            </div>
            <div>
              <p className="text-slate-500">วันที่ต้องการ</p>
              <p className="font-medium text-slate-800">
                {pr.needed_by ? formatDateTime(pr.needed_by) : "—"}
              </p>
            </div>
            {pr.note && (
              <div className="col-span-2">
                <p className="text-slate-500">หมายเหตุ</p>
                <p className="font-medium text-slate-800">{pr.note}</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── รายการสินค้า ──────────────────────────────────────────────────── */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-6 py-4">
          <h3 className="font-semibold text-slate-700">รายการสินค้า</h3>
        </div>
        <table className="min-w-full text-sm">
          <thead className="border-b border-slate-100 bg-slate-50">
            <tr>
              <th className="px-4 py-2 text-left font-medium text-slate-500">#</th>
              <th className="px-4 py-2 text-left font-medium text-slate-500">สินค้า</th>
              <th className="px-4 py-2 text-right font-medium text-slate-500">จำนวน</th>
              <th className="px-4 py-2 text-left font-medium text-slate-500">หน่วย</th>
              <th className="px-4 py-2 text-right font-medium text-slate-500">ราคา/หน่วย</th>
              <th className="px-4 py-2 text-right font-medium text-slate-500">รวม</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {((items ?? []) as any[]).map((item) => {
              const product = item.products as { name: string; unit: string; sku: string } | null;
              return (
                <tr key={item.id}>
                  <td className="px-4 py-2 text-slate-400">{item.line_no}</td>
                  <td className="px-4 py-2">
                    <p className="font-medium text-slate-800">{item.description}</p>
                    {product && <p className="text-xs text-slate-400">{product.sku}</p>}
                  </td>
                  <td className="px-4 py-2 text-right text-slate-700">
                    {Number(item.quantity).toLocaleString("th-TH")}
                  </td>
                  <td className="px-4 py-2 text-slate-500">{item.unit}</td>
                  <td className="px-4 py-2 text-right text-slate-700">
                    {formatCurrency(item.unit_price)}
                  </td>
                  <td className="px-4 py-2 text-right font-medium text-slate-800">
                    {formatCurrency(item.line_total ?? item.quantity * item.unit_price)}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot className="border-t border-slate-200 bg-slate-50">
            <tr>
              <td colSpan={5} className="px-4 py-3 text-right font-semibold text-slate-700">
                รวมทั้งสิ้น
              </td>
              <td className="px-4 py-3 text-right font-bold text-slate-900">
                {formatCurrency(pr.total_amount)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* ── Activity timeline ─────────────────────────────────────────────── */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-center gap-2">
          <Clock size={16} className="text-slate-400" />
          <h3 className="font-semibold text-slate-700">ประวัติการดำเนินการ PR</h3>
        </div>
        <ol className="relative border-l border-slate-200 ml-2 space-y-5">
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
              </li>
            );
          })}
        </ol>
      </div>

      {/* ── PR Approval Panel ────────────────────────────────────────────── */}
      <PRApprovalPanel
        pr={{
          id: pr.id,
          pr_number: pr.pr_number,
          title: pr.title,
          total_amount: pr.total_amount,
          status: pr.status as PrStatus,
          requester_id: pr.requester_id,
        }}
        currentUserId={user?.id ?? ""}
        currentUserName={(currentProfile as any)?.full_name ?? user?.email ?? ""}
        currentUserRole={currentUserRole}
      />

      {/* ── PO section divider ───────────────────────────────────────────── */}
      {(canCreatePO || hasPO) && (
        <div className="flex items-center gap-3 py-1">
          <div className="flex-1 border-t border-slate-200" />
          <span className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">
            ใบสั่งซื้อ (PO)
          </span>
          <div className="flex-1 border-t border-slate-200" />
        </div>
      )}

      {/* ── Inline PO creation ───────────────────────────────────────────── */}
      {canCreatePO && (
        <POCreationSection
          prId={pr.id}
          prNumber={pr.pr_number}
          prTitle={pr.title}
          prTotalAmount={pr.total_amount}
          prItems={prItemsForPO}
          currentUserId={user?.id ?? ""}
        />
      )}

      {/* ── Inline PO detail ─────────────────────────────────────────────── */}
      {hasPO && poDetail && (
        <PODetailSection
          po={poDetail}
          poItems={poItems}
          attachments={poAttachments}
          bills={poBills}
          currentUserId={user?.id ?? ""}
          currentUserRole={currentUserRole}
          prId={pr.id}
        />
      )}

      {/* ── Step 5: Evidence section divider ────────────────────────────── */}
      {poStatus === "approved" && (
        <div className="flex items-center gap-3 py-1">
          <div className="flex-1 border-t border-slate-200" />
          <span className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">
            แนบหลักฐาน
          </span>
          <div className="flex-1 border-t border-slate-200" />
        </div>
      )}

      {/* ── Inline Evidence Submission (ยังไม่ส่ง + เป็นเจ้าของ) ──────────── */}
      {poStatus === "approved" && !hasEvidence && isOwner && poDetail && (
        <EvidenceSubmissionSection
          poId={poDetail.id}
          prId={pr.id}
          prBankName={(pr as any).bank_name ?? null}
          prBankAccount={(pr as any).bank_account_number ?? null}
          currentUserId={user?.id ?? ""}
        />
      )}

      {/* รอผู้สั่งซื้อแนบหลักฐาน (แสดงเมื่อยังไม่ส่งและไม่ใช่เจ้าของ) */}
      {poStatus === "approved" && !hasEvidence && !isOwner && (
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-6 py-8 text-center">
          <p className="text-sm font-medium text-slate-500">รอผู้สั่งซื้อแนบหลักฐานการรับของ</p>
          <p className="mt-1 text-xs text-slate-400">ผู้สั่งซื้อจะต้องแนบบิลและข้อมูลผู้รับเงินก่อนดำเนินการต่อ</p>
        </div>
      )}

      {/* ── Evidence Detail (ส่งแล้ว — read-only) ───────────────────────── */}
      {hasEvidence && paymentEvidence && (
        <EvidenceDetailSection
          evidence={paymentEvidence}
          files={evidenceFiles}
        />
      )}

      {/* Extra POs (edge case: more than 1 PO linked) */}
      {linkedPOs && (linkedPOs as any[]).length > 1 && (
        <div className="space-y-1.5">
          {(linkedPOs as any[]).slice(1).map((po: any) => (
            <Link
              key={po.id}
              href={`/orders/${po.id}`}
              className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm hover:bg-slate-50"
            >
              <span className="font-mono text-xs font-bold text-slate-600">{po.po_number}</span>
              <span className="text-xs text-slate-400">ดู PO →</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
