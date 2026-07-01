"use client";
import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import { ArrowLeft, Plus, Trash2, CheckCircle, XCircle, Send, Banknote } from "lucide-react";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { formatCurrency, formatDate } from "@/lib/utils/format";
import type { BOQItem, ConstructionTicket, ConstructionPaymentRequest, UserRole } from "@/types/database";

interface EditableBOQRow {
  id?: string;
  description: string;
  unit: string;
  quantity: number;
  unit_price: number;
}

export default function ConstructionTicketPage() {
  const params = useParams<{ id: string }>();
  const ticketId = params?.id ?? "";
  const supabase = createClient();

  const [ticket, setTicket] = useState<ConstructionTicket | null>(null);
  const [boqItems, setBoqItems] = useState<BOQItem[]>([]);
  const [paymentRequest, setPaymentRequest] = useState<ConstructionPaymentRequest | null>(null);
  const [currentUser, setCurrentUser] = useState<{ id: string; role: UserRole } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // BOQ editing state
  const [editRows, setEditRows] = useState<EditableBOQRow[]>([]);
  const [isEditingBOQ, setIsEditingBOQ] = useState(false);
  const [rawBOQInputs, setRawBOQInputs] = useState<Record<string, string>>({});

  // Payment request form state
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [paymentNote, setPaymentNote] = useState("");

  const loadData = useCallback(async () => {
    const [
      { data: ticketData },
      { data: boqData },
      { data: paymentData },
      { data: { user } },
    ] = await Promise.all([
      (supabase as any).from("construction_tickets").select("*").eq("id", ticketId).single(),
      (supabase as any).from("boq_items").select("*").eq("ticket_id", ticketId).order("sort_order"),
      (supabase as any).from("construction_payment_requests").select("*").eq("ticket_id", ticketId).order("created_at", { ascending: false }).limit(1).maybeSingle(),
      supabase.auth.getUser(),
    ]);
    setTicket(ticketData);
    setBoqItems(boqData ?? []);
    setPaymentRequest(paymentData);
    setIsLoading(false);

    if (user) {
      const { data: profile } = await (supabase as any).from("profiles").select("role").eq("id", user.id).single();
      setCurrentUser({ id: user.id, role: profile?.role });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ticketId]);

  useEffect(() => { loadData(); }, [loadData]);

  function startEditBOQ() {
    setEditRows(
      boqItems.length > 0
        ? boqItems.map((r) => ({ id: r.id, description: r.description, unit: r.unit, quantity: r.quantity, unit_price: r.unit_price }))
        : [{ description: "", unit: "", quantity: 1, unit_price: 0 }]
    );
    setIsEditingBOQ(true);
  }

  function updateEditRow(index: number, field: keyof EditableBOQRow, value: string | number) {
    setEditRows((prev) => prev.map((row, i) => i === index ? { ...row, [field]: value } : row));
  }

  async function saveBOQ() {
    if (!ticket) return;
    if (editRows.some((r) => !r.description || !r.unit)) return;
    setIsSubmitting(true);

    await (supabase as any).from("boq_items").delete().eq("ticket_id", ticketId);

    const rows = editRows.map((r, i) => ({
      ticket_id: ticketId,
      description: r.description,
      unit: r.unit,
      quantity: r.quantity,
      unit_price: r.unit_price,
      sort_order: i,
    }));
    await (supabase as any).from("boq_items").insert(rows);

    const total = editRows.reduce((s, r) => s + r.quantity * r.unit_price, 0);
    await (supabase as any).from("construction_tickets").update({ boq_total: total }).eq("id", ticketId);

    setIsEditingBOQ(false);
    setIsSubmitting(false);
    await loadData();
  }

  async function submitBOQForApproval() {
    setIsSubmitting(true);
    await (supabase as any).from("construction_tickets").update({ status: "boq_pending" }).eq("id", ticketId);
    setIsSubmitting(false);
    await loadData();
  }

  async function approveBOQ() {
    setIsSubmitting(true);
    await (supabase as any).from("construction_tickets").update({ status: "boq_approved" }).eq("id", ticketId);
    setIsSubmitting(false);
    await loadData();
  }

  async function rejectBOQ() {
    setIsSubmitting(true);
    await (supabase as any).from("construction_tickets").update({ status: "open" }).eq("id", ticketId);
    setIsSubmitting(false);
    await loadData();
  }

  async function submitPaymentRequest() {
    if (!currentUser || !ticket) return;
    setIsSubmitting(true);

    const { data: reqNumber } = await supabase.rpc("next_document_number", {
      prefix: "PMT",
      table_name: "construction_payment_requests",
      column_name: "request_number",
    });

    await (supabase as any).from("construction_payment_requests").insert({
      request_number: reqNumber ?? `PMT-${Date.now()}`,
      ticket_id: ticketId,
      amount: ticket.boq_total,
      requester_id: currentUser.id,
      note: paymentNote || null,
      status: "pending",
    });

    await (supabase as any).from("construction_tickets").update({ status: "payment_pending" }).eq("id", ticketId);

    setShowPaymentForm(false);
    setPaymentNote("");
    setIsSubmitting(false);
    await loadData();
  }

  async function inspectPayment() {
    if (!paymentRequest || !currentUser) return;
    setIsSubmitting(true);
    await (supabase as any).from("construction_payment_requests").update({
      status: "inspected",
      inspector_id: currentUser.id,
      inspected_at: new Date().toISOString(),
    }).eq("id", paymentRequest.id);
    setIsSubmitting(false);
    await loadData();
  }

  async function approvePayment() {
    if (!paymentRequest || !currentUser) return;
    setIsSubmitting(true);
    await (supabase as any).from("construction_payment_requests").update({
      status: "approved",
      approved_by: currentUser.id,
      approved_at: new Date().toISOString(),
    }).eq("id", paymentRequest.id);
    await (supabase as any).from("construction_tickets").update({ status: "payment_approved" }).eq("id", ticketId);
    setIsSubmitting(false);
    await loadData();
  }

  if (isLoading) {
    return <div className="py-16 text-center text-sm text-slate-400">กำลังโหลด...</div>;
  }

  if (!ticket) {
    return (
      <div className="py-16 text-center">
        <p className="text-slate-500">ไม่พบงานก่อสร้างนี้</p>
        <Link href="/construction" className="mt-2 text-sm text-violet-600 hover:underline">กลับรายการ</Link>
      </div>
    );
  }

  const isApprover = currentUser?.role === "manager" || currentUser?.role === "admin";
  const isOwner = currentUser?.id === ticket.requester_id;
  const boqTotal = boqItems.reduce((s, r) => s + r.line_total, 0);
  const editTotal = editRows.reduce((s, r) => s + r.quantity * r.unit_price, 0);

  return (
    <div className="mx-auto max-w-3xl space-y-5">

      {/* Header */}
      <div className="flex items-start gap-3">
        <Link href="/construction" className="mt-1 text-slate-400 hover:text-slate-600">
          <ArrowLeft size={20} />
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-mono text-xs font-bold text-slate-500">{ticket.ticket_number}</span>
            <StatusBadge kind="construction" status={ticket.status} />
          </div>
          <h1 className="mt-0.5 text-xl font-bold text-slate-800">{ticket.title}</h1>
          {ticket.location && <p className="text-sm text-slate-500">{ticket.location}</p>}
        </div>
      </div>

      {/* ข้อมูลงาน */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-slate-500">วันที่เปิด</p>
            <p className="font-medium text-slate-800">{formatDate(ticket.created_at)}</p>
          </div>
          <div>
            <p className="text-slate-500">ยอด BOQ รวม</p>
            <p className="font-bold text-violet-700">{formatCurrency(ticket.boq_total)}</p>
          </div>
          {ticket.description && (
            <div className="col-span-2">
              <p className="text-slate-500">รายละเอียด</p>
              <p className="font-medium text-slate-800 whitespace-pre-wrap">{ticket.description}</p>
            </div>
          )}
        </div>
      </div>

      {/* BOQ Section */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <h2 className="font-semibold text-slate-700">BOQ รายการงาน</h2>
          {ticket.status === "open" && !isEditingBOQ && (
            <button
              onClick={startEditBOQ}
              className="text-sm text-violet-600 hover:text-violet-800"
            >
              {boqItems.length > 0 ? "แก้ไข BOQ" : "+ เพิ่มรายการ"}
            </button>
          )}
        </div>

        {isEditingBOQ ? (
          <div className="p-5 space-y-4">
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="border-b border-slate-100 bg-slate-50">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium text-slate-500">รายการ</th>
                    <th className="w-20 px-3 py-2 text-left font-medium text-slate-500">หน่วย</th>
                    <th className="w-24 px-3 py-2 text-right font-medium text-slate-500">จำนวน</th>
                    <th className="w-28 px-3 py-2 text-right font-medium text-slate-500">ราคา/หน่วย</th>
                    <th className="w-28 px-3 py-2 text-right font-medium text-slate-500">รวม</th>
                    <th className="w-8 px-3 py-2" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {editRows.map((row, i) => (
                    <tr key={i}>
                      <td className="px-3 py-2">
                        <input
                          value={row.description}
                          onChange={(e) => updateEditRow(i, "description", e.target.value)}
                          placeholder="รายละเอียดงาน"
                          className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm focus:border-violet-500 focus:outline-none"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          value={row.unit}
                          onChange={(e) => updateEditRow(i, "unit", e.target.value)}
                          placeholder="ชิ้น"
                          className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm focus:border-violet-500 focus:outline-none"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="text"
                          inputMode="decimal"
                          value={rawBOQInputs[`${i}_q`] ?? String(row.quantity)}
                          onChange={(e) => {
                            setRawBOQInputs(p => ({ ...p, [`${i}_q`]: e.target.value }));
                            updateEditRow(i, "quantity", parseFloat(e.target.value) || 0);
                          }}
                          className="w-full rounded border border-slate-300 px-2 py-1.5 text-right text-sm focus:border-violet-500 focus:outline-none"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="text"
                          inputMode="decimal"
                          value={rawBOQInputs[`${i}_p`] ?? String(row.unit_price)}
                          onChange={(e) => {
                            setRawBOQInputs(p => ({ ...p, [`${i}_p`]: e.target.value }));
                            updateEditRow(i, "unit_price", parseFloat(e.target.value) || 0);
                          }}
                          className="w-full rounded border border-slate-300 px-2 py-1.5 text-right text-sm focus:border-violet-500 focus:outline-none"
                        />
                      </td>
                      <td className="px-3 py-2 text-right font-medium text-slate-700">
                        {(row.quantity * row.unit_price).toLocaleString("th-TH", { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-3 py-2">
                        {editRows.length > 1 && (
                          <button
                            type="button"
                            onClick={() => setEditRows((prev) => prev.filter((_, j) => j !== i))}
                            className="text-slate-300 hover:text-red-500"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="border-t border-slate-200 bg-slate-50">
                  <tr>
                    <td colSpan={4} className="px-3 py-3 text-right font-semibold text-slate-700">รวมทั้งสิ้น</td>
                    <td className="px-3 py-3 text-right font-bold text-slate-900">
                      ฿{editTotal.toLocaleString("th-TH", { minimumFractionDigits: 2 })}
                    </td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
            <button
              type="button"
              onClick={() => setEditRows((prev) => [...prev, { description: "", unit: "", quantity: 1, unit_price: 0 }])}
              className="flex items-center gap-1 text-sm text-violet-600 hover:text-violet-800"
            >
              <Plus size={14} /> เพิ่มรายการ
            </button>
            <div className="flex gap-3">
              <button
                onClick={saveBOQ}
                disabled={isSubmitting}
                className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
              >
                {isSubmitting ? "กำลังบันทึก..." : "บันทึก BOQ"}
              </button>
              <button
                onClick={() => setIsEditingBOQ(false)}
                className="text-sm text-slate-400 hover:text-slate-600"
              >
                ยกเลิก
              </button>
            </div>
          </div>
        ) : boqItems.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="border-b border-slate-100 bg-slate-50">
                <tr>
                  <th className="px-4 py-2 text-left font-medium text-slate-500">#</th>
                  <th className="px-4 py-2 text-left font-medium text-slate-500">รายการ</th>
                  <th className="px-4 py-2 text-left font-medium text-slate-500">หน่วย</th>
                  <th className="px-4 py-2 text-right font-medium text-slate-500">จำนวน</th>
                  <th className="px-4 py-2 text-right font-medium text-slate-500">ราคา/หน่วย</th>
                  <th className="px-4 py-2 text-right font-medium text-slate-500">รวม</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {boqItems.map((item, i) => (
                  <tr key={item.id}>
                    <td className="px-4 py-2 text-slate-400">{i + 1}</td>
                    <td className="px-4 py-2 text-slate-800">{item.description}</td>
                    <td className="px-4 py-2 text-slate-500">{item.unit}</td>
                    <td className="px-4 py-2 text-right text-slate-700">{item.quantity.toLocaleString("th-TH")}</td>
                    <td className="px-4 py-2 text-right text-slate-700">{formatCurrency(item.unit_price)}</td>
                    <td className="px-4 py-2 text-right font-medium text-slate-800">{formatCurrency(item.line_total)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t border-slate-200 bg-slate-50">
                <tr>
                  <td colSpan={5} className="px-4 py-3 text-right font-semibold text-slate-700">รวมทั้งสิ้น</td>
                  <td className="px-4 py-3 text-right font-bold text-violet-700">{formatCurrency(boqTotal)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        ) : (
          <div className="py-12 text-center text-sm text-slate-400">
            ยังไม่มีรายการ BOQ
            {ticket.status === "open" && (
              <button onClick={startEditBOQ} className="ml-2 text-violet-600 hover:underline">เพิ่มรายการ</button>
            )}
          </div>
        )}
      </div>

      {/* Action Panel */}
      {ticket.status === "open" && boqItems.length > 0 && isOwner && !isEditingBOQ && (
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="mb-3 font-semibold text-slate-700">การดำเนินการ</h3>
          <button
            onClick={submitBOQForApproval}
            disabled={isSubmitting}
            className="flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-violet-700 disabled:opacity-60"
          >
            <Send size={15} />
            ส่ง BOQ ขออนุมัติ
          </button>
        </div>
      )}

      {ticket.status === "boq_pending" && isApprover && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-5 shadow-sm">
          <h3 className="mb-3 font-semibold text-amber-800">อนุมัติ BOQ</h3>
          <p className="mb-3 text-sm text-amber-700">BOQ ยอดรวม {formatCurrency(boqTotal)} รอการอนุมัติ</p>
          <div className="flex gap-3">
            <button
              onClick={approveBOQ}
              disabled={isSubmitting}
              className="flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
            >
              <CheckCircle size={15} />
              อนุมัติ BOQ
            </button>
            <button
              onClick={rejectBOQ}
              disabled={isSubmitting}
              className="flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
            >
              <XCircle size={15} />
              ส่งกลับแก้ไข
            </button>
          </div>
        </div>
      )}

      {ticket.status === "boq_approved" && isOwner && !paymentRequest && (
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="mb-3 font-semibold text-slate-700">ขอเบิกเงิน</h3>
          {showPaymentForm ? (
            <div className="space-y-3">
              <div>
                <p className="text-sm text-slate-500">ยอดขอเบิก (ตาม BOQ)</p>
                <p className="text-lg font-bold text-violet-700">{formatCurrency(ticket.boq_total)}</p>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">หมายเหตุ</label>
                <textarea
                  value={paymentNote}
                  onChange={(e) => setPaymentNote(e.target.value)}
                  rows={2}
                  placeholder="รายละเอียดเพิ่มเติม..."
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-violet-500 focus:outline-none"
                />
              </div>
              <div className="flex gap-3">
                <button
                  onClick={submitPaymentRequest}
                  disabled={isSubmitting}
                  className="flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
                >
                  <Send size={15} />
                  {isSubmitting ? "กำลังส่ง..." : "ส่งขอเบิก"}
                </button>
                <button onClick={() => setShowPaymentForm(false)} className="text-sm text-slate-400 hover:text-slate-600">
                  ยกเลิก
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setShowPaymentForm(true)}
              className="flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-violet-700"
            >
              <Banknote size={15} />
              ขอเบิก {formatCurrency(ticket.boq_total)}
            </button>
          )}
        </div>
      )}

      {paymentRequest && (
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-slate-700">ใบขอเบิก</h3>
            <StatusBadge kind="payment" status={paymentRequest.status} />
          </div>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-slate-500">เลขที่</p>
              <p className="font-mono font-semibold text-slate-800">{paymentRequest.request_number}</p>
            </div>
            <div>
              <p className="text-slate-500">ยอดขอเบิก</p>
              <p className="font-bold text-violet-700">{formatCurrency(paymentRequest.amount)}</p>
            </div>
            <div>
              <p className="text-slate-500">วันที่</p>
              <p className="text-slate-800">{formatDate(paymentRequest.created_at)}</p>
            </div>
            {paymentRequest.note && (
              <div className="col-span-2">
                <p className="text-slate-500">หมายเหตุ</p>
                <p className="text-slate-800">{paymentRequest.note}</p>
              </div>
            )}
          </div>

          {paymentRequest.status === "pending" && isApprover && (
            <div className="mt-4 flex gap-3">
              <button
                onClick={inspectPayment}
                disabled={isSubmitting}
                className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
              >
                <CheckCircle size={15} />
                ตรวจรับงาน
              </button>
            </div>
          )}

          {paymentRequest.status === "inspected" && isApprover && (
            <div className="mt-4 flex gap-3">
              <button
                onClick={approvePayment}
                disabled={isSubmitting}
                className="flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
              >
                <CheckCircle size={15} />
                อนุมัติจ่าย
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
