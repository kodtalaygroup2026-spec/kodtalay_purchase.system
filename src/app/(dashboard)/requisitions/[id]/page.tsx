import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { formatCurrency, formatDate } from "@/lib/utils/format";
import { PR_STATUS_LABELS } from "@/lib/constants";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { PRApprovalPanel } from "@/components/pr/PRApprovalPanel";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
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
    { data: approvals },
  ] = await Promise.all([
    supabase.auth.getUser(),
    supabase
      .from("purchase_requisitions")
      .select(`*, profiles!requester_id(full_name, email, role)`)
      .eq("id", id)
      .single(),
    supabase
      .from("pr_items")
      .select(`*, products(name, unit, sku)`)
      .eq("pr_id", id)
      .order("line_no"),
    supabase
      .from("approvals")
      .select(`*, profiles!approver_id(full_name, role)`)
      .eq("reference_id", id)
      .eq("reference_type", "PR")
      .order("step"),
  ]);

  if (!pr) notFound();

  const { data: currentProfile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user?.id ?? "")
    .single();

  const currentUserRole = currentProfile?.role as UserRole | undefined;
  const requester = pr.profiles as unknown as { full_name: string; email: string } | null;

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <Link href="/requisitions" className="text-slate-400 hover:text-slate-600">
            <ArrowLeft size={20} />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-mono text-sm font-bold text-slate-500">{pr.pr_number}</h1>
              <StatusBadge kind="pr" status={pr.status as PrStatus} />
            </div>
            <h2 className="mt-0.5 text-xl font-bold text-slate-800">{pr.title}</h2>
          </div>
        </div>
      </div>

      {/* ข้อมูล PR */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h3 className="mb-4 font-semibold text-slate-700">ข้อมูลทั่วไป</h3>
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
            <p className="font-medium text-slate-800">{formatDate(pr.created_at)}</p>
          </div>
          <div>
            <p className="text-slate-500">วันที่ต้องการ</p>
            <p className="font-medium text-slate-800">
              {pr.needed_by ? formatDate(pr.needed_by) : "—"}
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
            {(items ?? []).map((item) => {
              const product = item.products as unknown as { name: string; unit: string; sku: string } | null;
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
                    {item.quantity.toLocaleString("th-TH")}
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

      {/* Timeline การอนุมัติ */}
      {approvals && approvals.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="mb-4 font-semibold text-slate-700">ประวัติการอนุมัติ</h3>
          <div className="space-y-3">
            {approvals.map((approval) => {
              const approver = approval.profiles as unknown as { full_name: string; role: string } | null;
              return (
                <div key={approval.id} className="flex items-start gap-3 text-sm">
                  <div
                    className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${
                      approval.decision === "approved"
                        ? "bg-green-500"
                        : approval.decision === "rejected"
                        ? "bg-red-500"
                        : "bg-slate-300"
                    }`}
                  />
                  <div>
                    <p className="font-medium text-slate-800">
                      {approver?.full_name ?? "—"}{" "}
                      <span className="font-normal text-slate-500">
                        ({approval.decision === "approved"
                          ? "อนุมัติ"
                          : approval.decision === "rejected"
                          ? "ไม่อนุมัติ"
                          : "รออนุมัติ"}
                        )
                      </span>
                    </p>
                    {approval.note && (
                      <p className="text-slate-500">{approval.note}</p>
                    )}
                    {approval.decided_at && (
                      <p className="text-xs text-slate-400">
                        {formatDate(approval.decided_at)}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
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
