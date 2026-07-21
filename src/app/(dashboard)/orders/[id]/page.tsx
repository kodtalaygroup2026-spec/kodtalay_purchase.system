export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/utils/format";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { POApprovalPanel } from "@/components/po/POApprovalPanel";
import Link from "next/link";
import { ArrowLeft, AlertTriangle, CheckCircle2, FileText, ExternalLink } from "lucide-react";
import type { PoStatus, UserRole } from "@/types/database";

const PRICE_TOLERANCE = 0.10;

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function OrderDetailPage({ params }: PageProps) {
  const { id } = await params;
  const supabase = await createClient();

  const [
    { data: { user } },
    { data: po },
    { data: items },
  ] = await Promise.all([
    supabase.auth.getUser(),
    (supabase as any)
      .from("purchase_orders")
      .select(`
        *,
        profiles!created_by(full_name),
        purchase_requisitions(id, pr_number, title, total_amount)
      `)
      .eq("id", id)
      .single(),
    (supabase as any)
      .from("po_items")
      .select("*")
      .eq("po_id", id)
      .order("line_no"),
  ]);

  if (!po) notFound();

  const [{ data: currentProfile }, { data: attachments }] = await Promise.all([
    supabase.from("profiles").select("role").eq("id", user?.id ?? "").single(),
    (supabase as any).from("po_attachments").select("*").eq("po_id", id).order("created_at"),
  ]);

  const currentUserRole = currentProfile?.role as UserRole | undefined;
  const vendorDisplay = po.vendor_name ?? "—";
  const pr = po.purchase_requisitions as { id: string; pr_number: string; title: string; total_amount: number } | null;

  const itemsTyped = (items ?? []) as {
    id: string;
    line_no: number;
    description: string;
    quantity: number;
    unit: string;
    unit_price: number;
    pr_unit_price: number;
    line_total: number;
    received_qty: number;
  }[];

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Link href="/orders" className="text-slate-400 hover:text-slate-600">
          <ArrowLeft size={20} />
        </Link>
        <span className="text-sm text-slate-400">ใบสั่งซื้อ</span>
      </div>

      {/* ข้อมูลทั่วไป */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <StatusBadge kind="po" status={po.status as PoStatus} />
          <span className="rounded-md bg-slate-100 px-3 py-1 font-mono text-sm font-bold text-slate-700 tracking-wider border border-slate-200">
            {po.po_number}
          </span>
        </div>
        <h2 className="mb-4 text-xl font-bold text-slate-800">
          ใบสั่งซื้อ — {vendorDisplay}
        </h2>

        <div className="border-t border-slate-100 pt-4">
          <div className="grid grid-cols-2 gap-x-8 gap-y-3 text-sm">
            <div>
              <p className="text-slate-500">ร้านค้า / ผู้จำหน่าย</p>
              <p className="font-medium text-slate-800">{vendorDisplay}</p>
            </div>
            <div>
              <p className="text-slate-500">วันที่สั่ง</p>
              <p className="font-medium text-slate-800">{formatDate(po.order_date)}</p>
            </div>
            {po.note && (
              <div className="col-span-2">
                <p className="text-slate-500">หมายเหตุ</p>
                <p className="font-medium text-slate-800">{po.note}</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* PR Reference Card */}
      {pr && (
        <div className="rounded-xl border border-blue-100 bg-blue-50 px-5 py-4 shadow-sm">
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-widest text-blue-400">
            อ้างอิงจากใบขอซื้อ
          </p>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-mono text-sm font-bold text-blue-700">{pr.pr_number}</p>
              <p className="text-sm text-blue-600">{pr.title}</p>
              <p className="mt-0.5 text-xs text-blue-400">
                ยอด PR: {formatCurrency(pr.total_amount)}
              </p>
            </div>
            <Link
              href={`/requisitions/${pr.id}`}
              className="flex items-center gap-1 rounded-lg border border-blue-200 bg-white px-3 py-1.5 text-xs font-medium text-blue-600 transition hover:bg-blue-100"
            >
              ดู PR <ExternalLink size={11} />
            </Link>
          </div>
        </div>
      )}

      {/* ตารางเปรียบราคา PR vs PO */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-6 py-4">
          <h3 className="font-semibold text-slate-700">รายการสินค้า</h3>
          {pr && (
            <p className="mt-0.5 text-xs text-slate-400">
              เปรียบเทียบราคา PR (อ้างอิง) กับราคา PO จริง — เกิน 10% = ไม่ผ่าน
            </p>
          )}
        </div>
        <table className="min-w-full text-sm">
          <thead className="border-b border-slate-100 bg-slate-50">
            <tr>
              <th className="px-4 py-2 text-left font-medium text-slate-500">#</th>
              <th className="px-4 py-2 text-left font-medium text-slate-500">รายการ</th>
              <th className="px-4 py-2 text-right font-medium text-slate-500">จำนวน</th>
              {pr && <th className="px-4 py-2 text-right font-medium text-slate-500">ราคา PR</th>}
              <th className="px-4 py-2 text-right font-medium text-slate-500">ราคา PO</th>
              {pr && <th className="px-4 py-2 text-right font-medium text-slate-500">ต่าง%</th>}
              <th className="px-4 py-2 text-right font-medium text-slate-500">รวม</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {itemsTyped.map((item) => {
              const variancePct = pr && item.pr_unit_price > 0
                ? (item.unit_price - item.pr_unit_price) / item.pr_unit_price
                : 0;
              const isOver = variancePct > PRICE_TOLERANCE;
              return (
                <tr key={item.id} className={isOver ? "bg-red-50" : undefined}>
                  <td className="px-4 py-2 text-slate-400">{item.line_no}</td>
                  <td className="px-4 py-2">
                    <p className="font-medium text-slate-800">{item.description}</p>
                  </td>
                  <td className="px-4 py-2 text-right text-slate-600">
                    {Number(item.quantity).toLocaleString("th-TH")} {item.unit}
                  </td>
                  {pr && (
                    <td className="px-4 py-2 text-right text-slate-400">
                      {item.pr_unit_price > 0 ? formatCurrency(item.pr_unit_price) : "—"}
                    </td>
                  )}
                  <td className="px-4 py-2 text-right font-medium text-slate-800">
                    {formatCurrency(item.unit_price)}
                  </td>
                  {pr && (
                    <td className="px-4 py-2 text-right">
                      {item.pr_unit_price > 0 ? (
                        <span className={`text-xs font-semibold ${isOver ? "text-red-600" : "text-green-600"}`}>
                          {isOver && <AlertTriangle size={10} className="mr-0.5 inline" />}
                          {variancePct >= 0 ? "+" : ""}
                          {(variancePct * 100).toFixed(1)}%
                        </span>
                      ) : (
                        <span className="text-xs text-slate-300">—</span>
                      )}
                    </td>
                  )}
                  <td className="px-4 py-2 text-right font-medium text-slate-800">
                    {formatCurrency(item.line_total ?? item.quantity * item.unit_price)}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot className="border-t border-slate-200 bg-slate-50">
            {pr && (
              <tr>
                <td colSpan={pr ? 7 : 5} className="px-4 py-2">
                  {po.total_amount <= (pr.total_amount * 1.10 + pr.total_amount * 0.07) ? (
                    <div className="flex items-center gap-1.5 text-xs text-green-600">
                      <CheckCircle2 size={13} /> ยอดรวม PO อยู่ในเกณฑ์ที่กำหนด
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5 text-xs text-red-600">
                      <AlertTriangle size={13} /> ยอดรวม PO เกินงบ PR เกิน 10%
                    </div>
                  )}
                </td>
              </tr>
            )}
            <tr>
              <td colSpan={pr ? 6 : 4} className="px-4 py-2 text-right text-sm text-slate-500">
                ราคาก่อน VAT
              </td>
              <td className="px-4 py-2 text-right text-slate-700">{formatCurrency(po.subtotal)}</td>
            </tr>
            <tr>
              <td colSpan={pr ? 6 : 4} className="px-4 py-2 text-right text-sm text-slate-500">
                VAT {po.vat_rate}%
              </td>
              <td className="px-4 py-2 text-right text-slate-700">{formatCurrency(po.vat_amount)}</td>
            </tr>
            <tr>
              <td colSpan={pr ? 6 : 4} className="px-4 py-3 text-right font-semibold text-slate-700">
                รวมทั้งสิ้น
              </td>
              <td className="px-4 py-3 text-right font-bold text-slate-900">
                {formatCurrency(po.total_amount)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* ไฟล์แนบ (บิล/ใบเสร็จ) */}
      {attachments && attachments.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="mb-4 font-semibold text-slate-700">บิล / ใบเสร็จที่แนบ</h3>
          <ul className="space-y-2">
            {(attachments as { id: string; file_name: string; file_url: string; file_type: string; file_size: number | null }[]).map((f) => (
              <li key={f.id} className="flex items-center gap-3 rounded-lg border border-slate-100 px-3 py-2">
                <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-md ${f.file_type === "image" ? "bg-blue-50" : "bg-red-50"}`}>
                  <FileText size={16} className={f.file_type === "image" ? "text-blue-400" : "text-red-400"} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-700">{f.file_name}</p>
                  {f.file_size && (
                    <p className="text-xs text-slate-400">
                      {f.file_size < 1024 * 1024
                        ? `${(f.file_size / 1024).toFixed(1)} KB`
                        : `${(f.file_size / (1024 * 1024)).toFixed(1)} MB`}
                    </p>
                  )}
                </div>
                <a
                  href={f.file_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 rounded-md border border-slate-200 px-2.5 py-1 text-xs text-slate-600 transition hover:bg-slate-50"
                >
                  เปิด <ExternalLink size={10} />
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Audit trail timestamps */}
      {(po.submitted_at || po.approved_at || po.cancelled_at) && (
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="mb-3 font-semibold text-slate-700">ประวัติการดำเนินการ</h3>
          <div className="space-y-2 text-sm">
            {po.submitted_at && (
              <div className="flex items-center gap-2 text-blue-600">
                <span className="h-2 w-2 rounded-full bg-blue-500" />
                ส่งขออนุมัติ — {formatDateTime(po.submitted_at)}
              </div>
            )}
            {po.approved_at && (
              <div className="flex items-center gap-2 text-green-600">
                <span className="h-2 w-2 rounded-full bg-green-500" />
                อนุมัติแล้ว — {formatDateTime(po.approved_at)}
              </div>
            )}
            {po.cancelled_at && (
              <div className="flex items-center gap-2 text-red-600">
                <span className="h-2 w-2 rounded-full bg-red-500" />
                ยกเลิก — {formatDateTime(po.cancelled_at)}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Approval Panel */}
      <POApprovalPanel
        po={{
          id: po.id,
          status: po.status as PoStatus,
          created_by: po.created_by,
          pr_id: po.pr_id,
        }}
        currentUserId={user?.id ?? ""}
        currentUserRole={currentUserRole}
      />
    </div>
  );
}
