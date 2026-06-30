import { formatCurrency, formatDateTime } from "@/lib/utils/format";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { POApprovalPanel } from "@/components/po/POApprovalPanel";
import { AlertTriangle, FileText, ImageIcon, ExternalLink, Clock, Receipt } from "lucide-react";
import type { PoStatus, UserRole } from "@/types/database";

const PRICE_TOLERANCE = 0.10;

function getVariancePct(poPrice: number, prPrice: number): number {
  if (prPrice === 0) return 0;
  return (poPrice - prPrice) / prPrice;
}

function formatFileSize(bytes: number | null): string {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

interface POItem {
  id: string;
  line_no: number;
  description: string;
  quantity: number;
  unit: string;
  unit_price: number;
  pr_unit_price: number;
  line_total: number;
}

interface POAttachment {
  id: string;
  file_name: string;
  file_url: string;
  file_type: "image" | "pdf";
  file_size: number | null;
}

interface PurchaseBill {
  id: string;
  bill_number: string | null;
  bill_date: string;
  bill_amount: number;
  vendor_name: string | null;
  notes: string | null;
  created_at: string;
}

interface PODetailSectionProps {
  po: {
    id: string;
    po_number: string;
    status: PoStatus;
    vendor_name: string | null;
    order_date: string;
    note: string | null;
    subtotal: number;
    vat_rate: number;
    vat_amount: number;
    total_amount: number;
    pr_total_amount: number | null;
    submitted_at: string | null;
    approved_at: string | null;
    cancelled_at: string | null;
    created_by: string;
    created_at: string;
  };
  poItems: POItem[];
  attachments: POAttachment[];
  bills: PurchaseBill[];
  currentUserId: string;
  currentUserRole: UserRole | undefined;
  prId: string;
}

export function PODetailSection({
  po, poItems, attachments, bills, currentUserId, currentUserRole, prId,
}: PODetailSectionProps) {
  const hasPrPrices = poItems.some(it => Number(it.pr_unit_price) > 0);
  // column count for tfoot colspan: #(1)+desc(2)+qty(3) + optional prPrice + poPrice + optional variance + total
  const emptyColSpan = hasPrPrices ? 5 : 3;

  return (
    <div className="space-y-5">
      {/* PO Info */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-start justify-between gap-3">
          <span className="rounded-md bg-slate-100 px-3 py-1 font-mono text-sm font-bold text-slate-700 border border-slate-200">
            {po.po_number}
          </span>
          <StatusBadge kind="po" status={po.status} />
        </div>
        <div className="grid grid-cols-2 gap-x-8 gap-y-3 text-sm">
          <div>
            <p className="text-slate-500">ร้านค้า / ผู้จำหน่าย</p>
            <p className="font-medium text-slate-800">{po.vendor_name ?? "—"}</p>
          </div>
          <div>
            <p className="text-slate-500">วันที่สั่งซื้อ</p>
            <p className="font-medium text-slate-800">{po.order_date}</p>
          </div>
          {po.note && (
            <div className="col-span-2">
              <p className="text-slate-500">หมายเหตุ</p>
              <p className="font-medium text-slate-800">{po.note}</p>
            </div>
          )}
        </div>
      </div>

      {/* Price comparison table */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-6 py-4">
          <h3 className="font-semibold text-slate-700">รายการสินค้า</h3>
          {hasPrPrices && (
            <p className="mt-0.5 text-xs text-slate-400">
              เปรียบเทียบราคา PR (อ้างอิง) vs ราคาจริงที่สั่ง
            </p>
          )}
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="border-b border-slate-100 bg-slate-50">
              <tr>
                <th className="px-4 py-2 text-left font-medium text-slate-500 w-8">#</th>
                <th className="px-4 py-2 text-left font-medium text-slate-500">รายการ</th>
                <th className="px-4 py-2 text-right font-medium text-slate-500">จำนวน</th>
                {hasPrPrices && (
                  <th className="px-4 py-2 text-right font-medium text-slate-400">ราคา PR</th>
                )}
                <th className="px-4 py-2 text-right font-medium text-slate-500">ราคาจริง</th>
                {hasPrPrices && (
                  <th className="px-4 py-2 text-right font-medium text-slate-500">ต่าง%</th>
                )}
                <th className="px-4 py-2 text-right font-medium text-slate-500">รวม</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {poItems.map(item => {
                const variancePct = hasPrPrices
                  ? getVariancePct(Number(item.unit_price), Number(item.pr_unit_price))
                  : 0;
                const isOver = hasPrPrices && variancePct > PRICE_TOLERANCE;
                return (
                  <tr key={item.id} className={isOver ? "bg-red-50" : undefined}>
                    <td className="px-4 py-2.5 text-slate-400">{item.line_no}</td>
                    <td className="px-4 py-2.5 font-medium text-slate-800">{item.description}</td>
                    <td className="px-4 py-2.5 text-right text-slate-600">
                      {Number(item.quantity).toLocaleString("th-TH")} {item.unit}
                    </td>
                    {hasPrPrices && (
                      <td className="px-4 py-2.5 text-right text-slate-400">
                        ฿{Number(item.pr_unit_price).toLocaleString("th-TH", { minimumFractionDigits: 2 })}
                      </td>
                    )}
                    <td className="px-4 py-2.5 text-right font-medium text-slate-800">
                      {formatCurrency(item.unit_price)}
                    </td>
                    {hasPrPrices && (
                      <td className="px-4 py-2.5 text-right">
                        <span className={`text-xs font-semibold ${isOver ? "text-red-600" : "text-green-600"}`}>
                          {isOver && <AlertTriangle size={10} className="mr-0.5 inline" />}
                          {variancePct >= 0 ? "+" : ""}
                          {(variancePct * 100).toFixed(1)}%
                        </span>
                      </td>
                    )}
                    <td className="px-4 py-2.5 text-right font-medium text-slate-800">
                      {formatCurrency(item.line_total ?? Number(item.quantity) * Number(item.unit_price))}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot className="border-t border-slate-200 bg-slate-50">
              <tr>
                <td colSpan={emptyColSpan} />
                <td className="px-4 py-2 text-right text-xs font-medium text-slate-500">ก่อน VAT</td>
                <td className="px-4 py-2 text-right font-semibold text-slate-800">
                  {formatCurrency(po.subtotal)}
                </td>
              </tr>
              <tr>
                <td colSpan={emptyColSpan} />
                <td className="px-4 py-1.5 text-right text-xs text-slate-400">VAT {po.vat_rate}%</td>
                <td className="px-4 py-1.5 text-right text-xs text-slate-500">
                  {formatCurrency(po.vat_amount)}
                </td>
              </tr>
              <tr className="border-t border-slate-100">
                <td colSpan={emptyColSpan} />
                <td className="px-4 py-3 text-right font-semibold text-slate-700">รวมทั้งสิ้น</td>
                <td className="px-4 py-3 text-right font-bold text-slate-900">
                  {formatCurrency(po.total_amount)}
                </td>
              </tr>
              {po.pr_total_amount ? (
                <tr className="border-t border-slate-100 bg-blue-50">
                  <td colSpan={emptyColSpan} />
                  <td className="px-4 py-2 text-right text-xs text-slate-400">งบ PR (อ้างอิง)</td>
                  <td className={`px-4 py-2 text-right text-xs font-semibold ${
                    po.total_amount > po.pr_total_amount * (1 + PRICE_TOLERANCE)
                      ? "text-red-600"
                      : "text-green-600"
                  }`}>
                    {formatCurrency(po.pr_total_amount)}
                    {po.total_amount > po.pr_total_amount * (1 + PRICE_TOLERANCE) && (
                      <span className="ml-1">⚠ เกินงบ</span>
                    )}
                  </td>
                </tr>
              ) : null}
            </tfoot>
          </table>
        </div>
      </div>

      {/* Attachments */}
      {attachments.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="mb-3 font-semibold text-slate-700">ไฟล์แนบ</h3>
          <ul className="space-y-2">
            {attachments.map(att => (
              <li key={att.id} className="flex items-center gap-3 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
                <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded ${
                  att.file_type === "image" ? "bg-blue-50" : "bg-red-50"
                }`}>
                  {att.file_type === "image"
                    ? <ImageIcon size={16} className="text-blue-400" />
                    : <FileText size={16} className="text-red-400" />}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-700">{att.file_name}</p>
                  {att.file_size && (
                    <p className="text-xs text-slate-400">{formatFileSize(att.file_size)}</p>
                  )}
                </div>
                <a
                  href={att.file_url}
                  target="_blank"
                  rel="noreferrer"
                  className="shrink-0 flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-600 transition hover:bg-slate-100"
                >
                  ดู <ExternalLink size={10} />
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* PO Timeline */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center gap-2">
          <Clock size={15} className="text-slate-400" />
          <h3 className="font-semibold text-slate-700">ประวัติ PO</h3>
        </div>
        <ol className="relative border-l border-slate-200 ml-2 space-y-4">
          <li className="ml-5">
            <span className="absolute -left-[9px] h-4 w-4 rounded-full bg-slate-400" />
            <p className="text-sm font-semibold text-slate-600">สร้าง PO</p>
            <p className="text-xs text-slate-400">{formatDateTime(po.created_at)}</p>
          </li>
          {po.submitted_at && (
            <li className="ml-5">
              <span className="absolute -left-[9px] h-4 w-4 rounded-full bg-blue-500" />
              <p className="text-sm font-semibold text-blue-600">ส่งขออนุมัติ</p>
              <p className="text-xs text-slate-400">{formatDateTime(po.submitted_at)}</p>
            </li>
          )}
          {po.approved_at && (
            <li className="ml-5">
              <span className="absolute -left-[9px] h-4 w-4 rounded-full bg-green-500" />
              <p className="text-sm font-semibold text-green-600">อนุมัติ PO</p>
              <p className="text-xs text-slate-400">{formatDateTime(po.approved_at)}</p>
            </li>
          )}
          {po.cancelled_at && (
            <li className="ml-5">
              <span className="absolute -left-[9px] h-4 w-4 rounded-full bg-red-500" />
              <p className="text-sm font-semibold text-red-600">ยกเลิก PO</p>
              <p className="text-xs text-slate-400">{formatDateTime(po.cancelled_at)}</p>
            </li>
          )}
        </ol>
      </div>

      {/* Bill records */}
      {bills.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-3 flex items-center gap-2">
            <Receipt size={15} className="text-slate-400" />
            <h3 className="font-semibold text-slate-700">บิล / ใบแจ้งหนี้</h3>
          </div>
          <div className="space-y-2">
            {bills.map(bill => (
              <div
                key={bill.id}
                className="rounded-lg border border-slate-100 bg-slate-50 px-4 py-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-800">
                        {bill.bill_number ?? "ไม่ระบุเลขที่บิล"}
                      </p>
                      {bill.vendor_name && (
                        <p className="text-xs text-slate-500">{bill.vendor_name}</p>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-slate-900">{formatCurrency(bill.bill_amount)}</p>
                    <p className="text-xs text-slate-400">
                      {new Date(bill.bill_date).toLocaleDateString("th-TH", {
                        year: "numeric", month: "short", day: "numeric",
                      })}
                    </p>
                  </div>
                </div>
                {bill.notes && (
                  <p className="mt-2 text-xs text-slate-500 border-t border-slate-200 pt-2">
                    {bill.notes}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Approval Panel */}
      <POApprovalPanel
        po={{ id: po.id, status: po.status, created_by: po.created_by, pr_id: prId }}
        currentUserId={currentUserId}
        currentUserRole={currentUserRole}
      />
    </div>
  );
}
