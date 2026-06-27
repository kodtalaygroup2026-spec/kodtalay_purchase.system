import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { formatCurrency, formatDateTime } from "@/lib/utils/format";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { PRApprovalPanel } from "@/components/pr/PRApprovalPanel";
import Link from "next/link";
import { ArrowLeft, Clock, CheckCircle2, XCircle, Send, X, FileText, ShoppingCart, ExternalLink } from "lucide-react";
import type { PrStatus, UserRole } from "@/types/database";

interface PageProps {
  params: Promise<{ id: string }>;
}

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

  // โหลด profile ของทุกคนที่มีส่วนร่วมใน audit trail
  const auditIds = [
    pr.submitted_by,
    pr.approved_by,
    pr.rejected_by,
    pr.cancelled_by,
  ].filter((v: unknown): v is string => typeof v === "string" && v.length > 0);
  const uniqueIds = [...new Set(auditIds)];

  const [{ data: currentProfile }, { data: auditProfileList }, { data: linkedPOs }] = await Promise.all([
    supabase.from("profiles").select("role").eq("id", user?.id ?? "").single(),
    uniqueIds.length > 0
      ? (supabase as any).from("profiles").select("id, full_name").in("id", uniqueIds)
      : Promise.resolve({ data: [] }),
    (supabase as any)
      .from("purchase_orders")
      .select("id, po_number, status, total_amount, created_at")
      .eq("pr_id", id)
      .order("created_at"),
  ]);

  const currentUserRole = currentProfile?.role as UserRole | undefined;
  const requester = pr.profiles as { full_name: string; email: string } | null;

  // map id → ชื่อสำหรับ audit trail
  const nameOf: Record<string, string> = Object.fromEntries(
    ((auditProfileList as { id: string; full_name: string }[] | null) ?? [])
      .map((p) => [p.id, p.full_name])
  );

  // สร้าง activity log เรียงตามเวลา
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
  // เรียงตามเวลาจากเก่า → ใหม่
  timeline.sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());

  const colorMap = {
    slate:  { dot: "bg-slate-400", text: "text-slate-500",  badge: "bg-slate-100 text-slate-600" },
    blue:   { dot: "bg-blue-500",  text: "text-blue-600",   badge: "bg-blue-50 text-blue-700" },
    green:  { dot: "bg-green-500", text: "text-green-600",  badge: "bg-green-50 text-green-700" },
    red:    { dot: "bg-red-500",   text: "text-red-600",    badge: "bg-red-50 text-red-700" },
    orange: { dot: "bg-orange-400",text: "text-orange-600", badge: "bg-orange-50 text-orange-700" },
  };

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      {/* Header — back button only */}
      <div className="flex items-center gap-2">
        <Link href="/requisitions" className="text-slate-400 hover:text-slate-600">
          <ArrowLeft size={20} />
        </Link>
        <span className="text-sm text-slate-400">ใบขอซื้อ</span>
      </div>

      {/* ข้อมูล PR */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        {/* PR number + status */}
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <StatusBadge kind="pr" status={pr.status as PrStatus} />
            {pr.is_urgent && (
              <span className="rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-semibold text-red-600">
                ด่วน
              </span>
            )}
          </div>
          <span className="rounded-md bg-slate-100 px-3 py-1 font-mono text-sm font-bold text-slate-700 tracking-wider border border-slate-200">
            {pr.pr_number}
          </span>
        </div>
        {/* Title */}
        <h2 className="mb-4 text-xl font-bold text-slate-800">{pr.title}</h2>
        <div className="border-t border-slate-100 pt-4">
        <div className="grid grid-cols-2 gap-x-8 gap-y-3 text-sm">
          <div>
            <p className="text-slate-500">ผู้ขอ</p>
            <p className="font-medium text-slate-800">{requester?.full_name ?? requester?.email ?? "—"}</p>
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

      {/* รายการสินค้า */}
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
                    {product && (
                      <p className="text-xs text-slate-400">{product.sku}</p>
                    )}
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

      {/* Activity Timeline — ใคร ทำอะไร เมื่อไหร่ */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-center gap-2">
          <Clock size={16} className="text-slate-400" />
          <h3 className="font-semibold text-slate-700">ประวัติการดำเนินการ</h3>
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

      {/* ใบสั่งซื้อที่เกี่ยวข้อง */}
      {linkedPOs && linkedPOs.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <ShoppingCart size={16} className="text-slate-400" />
            <h3 className="font-semibold text-slate-700">ใบสั่งซื้อ (PO) ที่เกี่ยวข้อง</h3>
          </div>
          <div className="space-y-2">
            {(linkedPOs as { id: string; po_number: string; status: string; total_amount: number; created_at: string }[]).map((po) => (
              <div key={po.id} className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50 px-4 py-3">
                <div className="flex items-center gap-3">
                  <span className="font-mono text-sm font-bold text-slate-700">{po.po_number}</span>
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                    po.status === "approved" ? "bg-green-100 text-green-700"
                    : po.status === "cancelled" ? "bg-red-100 text-red-700"
                    : po.status === "pending_approval" ? "bg-yellow-100 text-yellow-700"
                    : "bg-slate-100 text-slate-600"
                  }`}>
                    {po.status === "draft" ? "ร่าง"
                     : po.status === "pending_approval" ? "รออนุมัติ"
                     : po.status === "approved" ? "อนุมัติแล้ว"
                     : po.status === "cancelled" ? "ยกเลิก"
                     : po.status}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-semibold text-slate-800">
                    {formatCurrency(po.total_amount)}
                  </span>
                  <Link
                    href={`/orders/${po.id}`}
                    className="flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-600 transition hover:bg-slate-100"
                  >
                    ดู PO <ExternalLink size={10} />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Action Panel */}
      <PRApprovalPanel
        pr={{ id: pr.id, status: pr.status as PrStatus, requester_id: pr.requester_id }}
        currentUserId={user?.id ?? ""}
        currentUserRole={currentUserRole}
      />
    </div>
  );
}
