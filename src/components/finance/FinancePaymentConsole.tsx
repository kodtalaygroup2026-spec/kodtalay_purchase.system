"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Download, CheckCircle2, RotateCcw, XCircle, X, AlertCircle,
  CheckSquare, Square, Inbox, Loader2,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { logAudit } from "@/lib/supabase/audit";
import { formatCurrency } from "@/lib/utils/format";
import {
  generateKTBContent, validateKTBSettings,
  type KTBCompanySettings, type KTBRecipient,
} from "@/lib/utils/ktbFormat";

// ── ประเภทข้อมูล ────────────────────────────────────────────────────────────
export interface PaymentRow {
  id: string;
  pr_number: string;
  title: string;
  amount: number;
  branch_id: string | null;
  branch_code: string;
  branch_name: string;
  requester_name: string;
  requester_line_id: string | null;
  evidence_id: string | null;
  account_holder_name: string;
  bank_name: string;
  bank_account_number: string;
  ktb_branch_code: string;
}

export interface PaymentCompany {
  id: string;
  code: string;
  name: string;
  count: number;
  total: number;
}

interface Props {
  companies: PaymentCompany[];
  payments: PaymentRow[];
  settingsByBranch: Record<string, Record<string, string>>;
  currentUserId: string;
}

// ── สีบริษัท ──────────────────────────────────────────────────────────────────
const BRANCH_BADGE: Record<string, string> = {
  CK: "bg-red-600 text-white", BN: "bg-blue-600 text-white", RCA: "bg-emerald-600 text-white",
};
const branchBadge = (code: string) => BRANCH_BADGE[code] ?? "bg-slate-600 text-white";

function rowToSettings(row: Record<string, string> | undefined): KTBCompanySettings {
  return {
    payerAbbreviation: row?.payer_abbreviation ?? "",
    companyNameTH: row?.company_name_th ?? "",
    companyNameEN: row?.company_name_en ?? "",
    address: row?.address ?? "",
    province: row?.province ?? "",
    district: row?.district ?? "",
    subDistrict: row?.sub_district ?? "",
    postalCode: row?.postal_code ?? "",
    taxId: row?.tax_id ?? "",
    ktbCompanyId: row?.ktb_company_id ?? "",
    payerAccount: row?.payer_account ?? "",
  };
}

type ActionType = "pay" | "return" | "cancel";

export function FinancePaymentConsole({ companies, payments, settingsByBranch, currentUserId }: Props) {
  const router = useRouter();
  const supabase = createClient();

  const [selectedCompany, setSelectedCompany] = useState<string | null>(null); // branch code
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [batchNo, setBatchNo] = useState("000001");
  const [effectiveDate, setEffectiveDate] = useState(new Date().toISOString().slice(0, 10));

  const [modal, setModal] = useState<{ type: ActionType; rows: PaymentRow[] } | null>(null);
  const [reason, setReason] = useState("");
  const [processing, setProcessing] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [successMsg, setSuccessMsg] = useState("");

  // รายการที่มองเห็น (ตามบริษัทที่กรอง)
  const visible = useMemo(
    () => (selectedCompany ? payments.filter((p) => p.branch_code === selectedCompany) : payments),
    [payments, selectedCompany]
  );

  const selectedRows = payments.filter((p) => selected.has(p.id));
  const selectedTotal = selectedRows.reduce((s, p) => s + Number(p.amount), 0);
  const grandTotal = payments.reduce((s, p) => s + Number(p.amount), 0);

  // ── การเลือก ─────────────────────────────────────────────────────────────
  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  function toggleAllVisible() {
    const ids = visible.map((p) => p.id);
    const allSel = ids.length > 0 && ids.every((id) => selected.has(id));
    setSelected(allSel ? new Set() : new Set(ids));
  }
  function switchCompany(code: string | null) {
    setSelectedCompany(code);
    setSelected(new Set());
    setErrors([]);
    setSuccessMsg("");
  }

  // ── LINE ─────────────────────────────────────────────────────────────────
  async function sendLine(lineUserId: string, message: string) {
    try {
      await fetch("/api/notifications/line", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lineUserId, message }),
      });
    } catch { /* ignore */ }
  }

  // ── บันทึกจ่ายแล้ว (เดี่ยว/ชุด) ──────────────────────────────────────────────
  async function doMarkPaid(rows: PaymentRow[]) {
    const ids = rows.map((r) => r.id);
    const { data, error } = await (supabase as any)
      .from("purchase_requisitions")
      .update({ status: "paid", finance_action_at: new Date().toISOString() })
      .in("id", ids)
      .eq("status", "pending_finance")
      .select("id");
    if (error) throw error;

    const updatedIds: string[] = (data ?? []).map((d: any) => d.id);
    if (updatedIds.length === 0) {
      throw new Error("รายการถูกดำเนินการไปแล้ว กรุณารีเฟรช");
    }

    // อัปเดต evidence เป็น paid
    const evIds = rows.filter((r) => updatedIds.includes(r.id) && r.evidence_id).map((r) => r.evidence_id);
    if (evIds.length > 0) {
      await (supabase as any)
        .from("payment_evidences")
        .update({ status: "paid", reviewed_by: currentUserId, reviewed_at: new Date().toISOString() })
        .in("id", evIds);
    }

    logAudit({
      actorId: currentUserId,
      action: "payment_marked_paid",
      entity: "purchase_requisitions",
      metadata: { pr_ids: updatedIds, count: updatedIds.length },
    });
    return updatedIds.length;
  }

  // ── ตีกลับ ───────────────────────────────────────────────────────────────
  async function doReturn(row: PaymentRow, note: string) {
    const { data, error } = await (supabase as any)
      .from("purchase_requisitions")
      .update({ status: "approved" })
      .eq("id", row.id)
      .eq("status", "pending_finance")
      .select("id");
    if (error) throw error;
    if (!data || data.length === 0) throw new Error("รายการถูกดำเนินการไปแล้ว กรุณารีเฟรช");

    if (row.evidence_id) {
      await (supabase as any)
        .from("payment_evidences")
        .update({
          status: "returned",
          review_note: note,
          reviewed_by: currentUserId,
          reviewed_at: new Date().toISOString(),
        })
        .eq("id", row.evidence_id);
    }

    if (row.requester_line_id) {
      const origin = typeof window !== "undefined" ? window.location.origin : "";
      void sendLine(
        row.requester_line_id,
        `↩️ การจ่ายเงินถูกตีกลับ\n\n` +
        `เลขที่: ${row.pr_number}\nหัวข้อ: ${row.title}\n` +
        `เหตุผล: ${note}\n\n` +
        `กรุณาแก้ไขหลักฐานแล้วส่งใหม่\n${origin}/requisitions/${row.id}`
      );
    }

    logAudit({
      actorId: currentUserId,
      action: "payment_returned",
      entity: "purchase_requisitions",
      entityId: row.id,
      metadata: { pr_number: row.pr_number, note },
    });
  }

  // ── ยกเลิก ───────────────────────────────────────────────────────────────
  async function doCancel(row: PaymentRow, note: string) {
    const { data, error } = await (supabase as any)
      .from("purchase_requisitions")
      .update({ status: "cancelled", cancelled_by: currentUserId })
      .eq("id", row.id)
      .eq("status", "pending_finance")
      .select("id");
    if (error) throw error;
    if (!data || data.length === 0) throw new Error("รายการถูกดำเนินการไปแล้ว กรุณารีเฟรช");

    if (row.evidence_id) {
      await (supabase as any)
        .from("payment_evidences")
        .update({
          status: "cancelled",
          review_note: note,
          reviewed_by: currentUserId,
          reviewed_at: new Date().toISOString(),
        })
        .eq("id", row.evidence_id);
    }

    if (row.requester_line_id) {
      const origin = typeof window !== "undefined" ? window.location.origin : "";
      void sendLine(
        row.requester_line_id,
        `✖️ ใบขอซื้อถูกยกเลิกโดยฝ่ายการเงิน\n\n` +
        `เลขที่: ${row.pr_number}\nหัวข้อ: ${row.title}\n` +
        `เหตุผล: ${note}\n\n${origin}/requisitions/${row.id}`
      );
    }

    logAudit({
      actorId: currentUserId,
      action: "payment_cancelled",
      entity: "purchase_requisitions",
      entityId: row.id,
      metadata: { pr_number: row.pr_number, note },
    });
  }

  // ── ยืนยันจาก modal ─────────────────────────────────────────────────────────
  async function confirmModal() {
    if (!modal) return;
    if ((modal.type === "return" || modal.type === "cancel") && !reason.trim()) {
      setErrors(["กรุณาระบุเหตุผล"]);
      return;
    }
    setProcessing(true);
    setErrors([]);
    try {
      if (modal.type === "pay") {
        const n = await doMarkPaid(modal.rows);
        setSuccessMsg(`บันทึกจ่ายแล้ว ${n} รายการ`);
      } else if (modal.type === "return") {
        await doReturn(modal.rows[0], reason.trim());
        setSuccessMsg(`ตีกลับ ${modal.rows[0].pr_number} แล้ว`);
      } else {
        await doCancel(modal.rows[0], reason.trim());
        setSuccessMsg(`ยกเลิก ${modal.rows[0].pr_number} แล้ว`);
      }
      setModal(null);
      setReason("");
      setSelected(new Set());
      router.refresh();
    } catch (err: any) {
      setErrors([err?.message ?? "เกิดข้อผิดพลาด"]);
    } finally {
      setProcessing(false);
    }
  }

  // ── ดาวน์โหลดไฟล์ KTB ────────────────────────────────────────────────────────
  function downloadKTB() {
    setErrors([]);
    setSuccessMsg("");
    if (selectedRows.length === 0) {
      setErrors(["กรุณาเลือกรายการอย่างน้อย 1 รายการ"]);
      return;
    }
    // ต้องเป็นบริษัทเดียว (ไฟล์ 1 ชุด = 1 บริษัทผู้จ่าย)
    const branchIds = [...new Set(selectedRows.map((r) => r.branch_id))];
    if (branchIds.length > 1) {
      setErrors(["สร้างไฟล์ KTB ได้ทีละบริษัท — กรุณาเลือกบริษัทเดียว (ใช้แท็บด้านบนกรอง)"]);
      return;
    }
    const branchId = branchIds[0] ?? "";
    const settings = rowToSettings(settingsByBranch[branchId]);
    const settingErrors = validateKTBSettings(settings);
    if (settingErrors.length > 0) {
      setErrors([`ตั้งค่าบริษัทยังไม่ครบ: ${settingErrors.join(", ")} — ตั้งค่าที่หน้า KTB Smart Transfer`]);
      return;
    }
    // validate ผู้รับแต่ละราย
    const rowErrors: string[] = [];
    selectedRows.forEach((r) => {
      const acct = r.bank_account_number.replace(/\D/g, "");
      if (acct.length !== 10) rowErrors.push(`${r.pr_number}: เลขบัญชี KTB ต้อง 10 หลัก`);
      if (!r.ktb_branch_code || r.ktb_branch_code.trim().length < 3) rowErrors.push(`${r.pr_number}: ขาดรหัสสาขา KTB`);
      if (Number(r.amount) <= 0) rowErrors.push(`${r.pr_number}: ยอดต้องมากกว่า 0`);
    });
    if (rowErrors.length > 0) {
      setErrors(rowErrors);
      return;
    }

    const recipients: KTBRecipient[] = selectedRows.map((r, idx) => ({
      seqNo: idx + 1,
      name: r.account_holder_name,
      accountNumber: r.bank_account_number.replace(/\D/g, ""),
      branchCode: r.ktb_branch_code,
      amount: Number(r.amount),
    }));

    const content = generateKTBContent(settings, recipients, {
      batchNo,
      customerRefNo: `REF-${effectiveDate.replace(/-/g, "")}-01`,
      effectiveDate,
    });
    const date = effectiveDate.replace(/-/g, "");
    const filename = `KTB_3RD_${date}_${batchNo.padStart(6, "0")}.txt`;
    const blob = new Blob(["﻿" + content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    setSuccessMsg(`สร้างไฟล์ ${filename} แล้ว — ตรวจสอบแล้วกด "บันทึกจ่ายแล้ว" เพื่อปิดรายการ`);
  }

  const allVisibleSelected = visible.length > 0 && visible.every((p) => selected.has(p.id));

  return (
    <div className="space-y-4">
      {/* ── แท็บบริษัท ──────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={() => switchCompany(null)}
          className={`rounded-lg border-2 px-3 py-1.5 text-sm font-semibold transition ${
            selectedCompany === null
              ? "border-slate-700 bg-slate-700 text-white"
              : "border-slate-200 bg-white text-slate-500 hover:border-slate-300"
          }`}
        >
          ทั้งหมด {payments.length}
        </button>
        {companies.map((c) => (
          <button
            key={c.id}
            onClick={() => switchCompany(c.code)}
            className={`flex items-center gap-2 rounded-lg border-2 px-3 py-1.5 text-sm font-semibold transition ${
              selectedCompany === c.code
                ? "border-slate-700 bg-slate-50 text-slate-800"
                : "border-slate-200 bg-white text-slate-500 hover:border-slate-300"
            }`}
          >
            <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${branchBadge(c.code)}`}>{c.code}</span>
            {c.name}
            {c.count > 0 && (
              <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-amber-500 px-1.5 text-[10px] font-bold text-white">
                {c.count}
              </span>
            )}
          </button>
        ))}
        <span className="ml-auto text-sm text-slate-500">
          ยอดรวมรอจ่าย <span className="font-bold text-slate-800">{formatCurrency(grandTotal)}</span>
        </span>
      </div>

      {/* ── แถบ bulk ────────────────────────────────────────────────────────── */}
      {selected.size > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3">
          <span className="text-sm font-semibold text-blue-800">
            เลือก {selected.size} รายการ — {formatCurrency(selectedTotal)}
          </span>
          <div className="flex items-center gap-2 text-xs text-slate-600">
            <label>Batch</label>
            <input
              value={batchNo}
              onChange={(e) => setBatchNo(e.target.value.replace(/\D/g, "").slice(0, 6))}
              className="w-20 rounded border border-slate-300 px-2 py-1 font-mono"
            />
            <label>วันที่โอน</label>
            <input
              type="date"
              value={effectiveDate}
              onChange={(e) => setEffectiveDate(e.target.value)}
              className="rounded border border-slate-300 px-2 py-1"
            />
          </div>
          <div className="ml-auto flex items-center gap-2">
            <button
              onClick={downloadKTB}
              className="flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              <Download size={14} /> ดาวน์โหลดไฟล์ KTB
            </button>
            <button
              onClick={() => { setModal({ type: "pay", rows: selectedRows }); setReason(""); setErrors([]); }}
              className="flex items-center gap-1.5 rounded-lg bg-green-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-green-700"
            >
              <CheckCircle2 size={14} /> บันทึกว่าจ่ายแล้ว
            </button>
          </div>
        </div>
      )}

      {/* ── ข้อความ ─────────────────────────────────────────────────────────── */}
      {errors.length > 0 && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3">
          <div className="flex items-start gap-2">
            <AlertCircle size={16} className="mt-0.5 shrink-0 text-red-500" />
            <ul className="space-y-0.5 text-sm text-red-700">
              {errors.map((e, i) => <li key={i}>{e}</li>)}
            </ul>
          </div>
        </div>
      )}
      {successMsg && (
        <div className="flex items-center gap-2 rounded-xl border border-green-200 bg-green-50 px-4 py-3">
          <CheckCircle2 size={16} className="shrink-0 text-green-600" />
          <p className="text-sm font-medium text-green-700">{successMsg}</p>
        </div>
      )}

      {/* ── ตาราง ───────────────────────────────────────────────────────────── */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        {visible.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-14 text-slate-300">
            <Inbox size={28} />
            <p className="text-sm">ไม่มีรายการรอจ่าย</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="border-b border-slate-100 bg-slate-50">
                <tr>
                  <th className="px-4 py-3 text-left w-10">
                    <button onClick={toggleAllVisible} className="flex items-center">
                      {allVisibleSelected ? <CheckSquare size={16} className="text-blue-600" /> : <Square size={16} className="text-slate-400" />}
                    </button>
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-slate-500">เลขที่ PR</th>
                  <th className="px-4 py-3 text-left font-medium text-slate-500">ผู้รับเงิน</th>
                  <th className="px-4 py-3 text-left font-medium text-slate-500">ธนาคาร / บัญชี</th>
                  <th className="px-4 py-3 text-left font-medium text-slate-500">บริษัท</th>
                  <th className="px-4 py-3 text-right font-medium text-slate-500 whitespace-nowrap">ยอด</th>
                  <th className="px-4 py-3 text-center font-medium text-slate-500">จัดการ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {visible.map((p) => {
                  const isChecked = selected.has(p.id);
                  return (
                    <tr key={p.id} className={isChecked ? "bg-blue-50/50" : "hover:bg-slate-50"}>
                      <td className="px-4 py-3">
                        <button onClick={() => toggleOne(p.id)} className="flex items-center">
                          {isChecked ? <CheckSquare size={16} className="text-blue-600" /> : <Square size={16} className="text-slate-400" />}
                        </button>
                      </td>
                      <td className="px-4 py-3">
                        <Link href={`/requisitions/${p.id}`} className="font-mono text-xs font-bold text-blue-600 hover:underline">
                          {p.pr_number}
                        </Link>
                        <p className="max-w-[160px] truncate text-xs text-slate-400">{p.title}</p>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-slate-700">
                        {p.account_holder_name || "—"}
                        <p className="text-xs text-slate-400">{p.requester_name}</p>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="text-xs text-slate-600">{p.bank_name || "—"}</span>
                        <p className="font-mono text-xs text-slate-500">{p.bank_account_number || "—"}</p>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${branchBadge(p.branch_code)}`}>
                          {p.branch_code}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-slate-800 whitespace-nowrap">
                        {formatCurrency(p.amount)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => { setModal({ type: "pay", rows: [p] }); setReason(""); setErrors([]); }}
                            title="จ่าย"
                            className="flex items-center gap-1 rounded-md bg-green-600 px-2 py-1 text-xs font-medium text-white hover:bg-green-700"
                          >
                            <CheckCircle2 size={12} /> จ่าย
                          </button>
                          <button
                            onClick={() => { setModal({ type: "return", rows: [p] }); setReason(""); setErrors([]); }}
                            title="ตีกลับ"
                            className="flex items-center gap-1 rounded-md border border-amber-300 bg-amber-50 px-2 py-1 text-xs font-medium text-amber-700 hover:bg-amber-100"
                          >
                            <RotateCcw size={12} /> ตีกลับ
                          </button>
                          <button
                            onClick={() => { setModal({ type: "cancel", rows: [p] }); setReason(""); setErrors([]); }}
                            title="ยกเลิก"
                            className="flex items-center gap-1 rounded-md border border-slate-300 bg-white px-2 py-1 text-xs font-medium text-slate-500 hover:bg-red-50 hover:text-red-600 hover:border-red-200"
                          >
                            <XCircle size={12} /> ยกเลิก
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Modal ยืนยัน ─────────────────────────────────────────────────────── */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => !processing && setModal(null)}>
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-semibold text-slate-800">
                {modal.type === "pay" && `ยืนยันการจ่าย ${modal.rows.length} รายการ`}
                {modal.type === "return" && `ตีกลับ ${modal.rows[0].pr_number}`}
                {modal.type === "cancel" && `ยกเลิก ${modal.rows[0].pr_number}`}
              </h3>
              <button onClick={() => !processing && setModal(null)} className="rounded p-1 text-slate-400 hover:bg-slate-100">
                <X size={18} />
              </button>
            </div>

            {modal.type === "pay" ? (
              <p className="text-sm text-slate-600">
                ยืนยันบันทึกว่าจ่ายแล้ว รวม{" "}
                <span className="font-semibold text-slate-800">
                  {formatCurrency(modal.rows.reduce((s, r) => s + Number(r.amount), 0))}
                </span>{" "}
                — รายการจะถูกปิด (สถานะ: จ่ายแล้ว)
              </p>
            ) : (
              <>
                <p className="mb-2 text-sm text-slate-600">
                  {modal.type === "return"
                    ? "ส่งกลับให้ผู้สร้างแก้ไขหลักฐานแล้วส่งใหม่ — ระบุเหตุผล:"
                    : "ยกเลิกรายการนี้ถาวร — ระบุเหตุผล:"}
                </p>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  rows={3}
                  autoFocus
                  placeholder={modal.type === "return" ? "เช่น เลขบัญชีไม่ถูกต้อง / บิลไม่ชัด" : "เช่น ยกเลิกคำสั่งซื้อ"}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                />
              </>
            )}

            {errors.length > 0 && (
              <p className="mt-2 text-xs text-red-600">{errors[0]}</p>
            )}

            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() => !processing && setModal(null)}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50"
              >
                ยกเลิก
              </button>
              <button
                onClick={confirmModal}
                disabled={processing}
                className={`flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-60 ${
                  modal.type === "pay" ? "bg-green-600 hover:bg-green-700"
                    : modal.type === "return" ? "bg-amber-600 hover:bg-amber-700"
                    : "bg-red-600 hover:bg-red-700"
                }`}
              >
                {processing && <Loader2 size={14} className="animate-spin" />}
                {modal.type === "pay" ? "ยืนยันจ่าย" : modal.type === "return" ? "ยืนยันตีกลับ" : "ยืนยันยกเลิก"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
