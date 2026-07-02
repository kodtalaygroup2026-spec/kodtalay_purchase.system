"use client";

import { useState } from "react";
import Link from "next/link";
import { formatCurrency, formatDate } from "@/lib/utils/format";
import { Building2, Inbox, X, Download, Eye } from "lucide-react";

// ── สีประจำแต่ละบริษัท (keyed by branch code) ─────────────────────────────────
const COMPANY_THEME: Record<
  string,
  { bar: string; iconBg: string; iconText: string; badge: string; amount: string; ring: string; activeBg: string }
> = {
  CK:  { bar: "bg-red-500",     iconBg: "bg-red-50",     iconText: "text-red-500",     badge: "bg-red-600 text-white",     amount: "text-red-600",     ring: "ring-red-400",     activeBg: "bg-red-50/40" },
  BN:  { bar: "bg-blue-500",    iconBg: "bg-blue-50",    iconText: "text-blue-500",    badge: "bg-blue-600 text-white",    amount: "text-blue-600",    ring: "ring-blue-400",    activeBg: "bg-blue-50/40" },
  RCA: { bar: "bg-emerald-500", iconBg: "bg-emerald-50", iconText: "text-emerald-500", badge: "bg-emerald-600 text-white", amount: "text-emerald-600", ring: "ring-emerald-400", activeBg: "bg-emerald-50/40" },
};

const FALLBACK_THEME = {
  bar: "bg-slate-400", iconBg: "bg-slate-50", iconText: "text-slate-500",
  badge: "bg-slate-600 text-white", amount: "text-slate-700", ring: "ring-slate-400", activeBg: "bg-slate-50",
};

function themeFor(code: string) {
  return COMPANY_THEME[code] ?? FALLBACK_THEME;
}

export interface FinancePR {
  id: string;
  pr_number: string;
  title: string;
  amount: number;
  requester_name: string;
  branch_code: string;
  branch_name: string;
  paid_at?: string | null;
}

export interface FinanceCompany {
  code: string;
  name: string;
  count: number;
  total: number;
}

interface FinanceOverviewBoardProps {
  companies: FinanceCompany[];
  prs: FinancePR[];
}

export function FinanceOverviewBoard({ companies, prs }: FinanceOverviewBoardProps) {
  // null = แสดงทั้งหมด (ค่าเริ่มต้น)
  const [selectedCode, setSelectedCode] = useState<string | null>(null);

  const visiblePRs = selectedCode
    ? prs.filter((pr) => pr.branch_code === selectedCode)
    : prs;

  const selectedCompany = companies.find((c) => c.code === selectedCode) ?? null;

  const [showReport, setShowReport] = useState(false);

  function handleCardClick(code: string) {
    // คลิกซ้ำที่การ์ดเดิม = ยกเลิกตัวกรอง (กลับไปแสดงทั้งหมด)
    setSelectedCode((prev) => (prev === code ? null : code));
  }

  // ── สร้างรายงานข้อความของรายการที่จ่ายแล้ว (ตามบริษัทที่กรอง) ────────────────
  function buildReportText(): string {
    const scope = selectedCompany ? selectedCompany.name : "ทุกบริษัท";
    const total = visiblePRs.reduce((sum, pr) => sum + Number(pr.amount), 0);
    const lines: string[] = [];
    lines.push("รายงานรายการที่จ่ายแล้ว");
    lines.push(`บริษัท   : ${scope}`);
    lines.push(`ออกรายงาน: ${new Date().toLocaleString("th-TH")}`);
    lines.push(`จำนวน    : ${visiblePRs.length} รายการ`);
    lines.push("=".repeat(60));
    visiblePRs.forEach((pr, i) => {
      const amount = Number(pr.amount).toLocaleString("th-TH", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
      lines.push(
        `${String(i + 1).padStart(2, "0")}. ${pr.pr_number}  [${pr.branch_code}]  ` +
        `${pr.paid_at ? formatDate(pr.paid_at) : "-"}  ${amount} บาท`
      );
      lines.push(`    ${pr.title} — ${pr.requester_name}`);
    });
    lines.push("=".repeat(60));
    lines.push(
      `รวม ${visiblePRs.length} รายการ  ยอดรวม ${total.toLocaleString("th-TH", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })} บาท`
    );
    return lines.join("\r\n");
  }

  function downloadReport() {
    const content = buildReportText();
    const scope = selectedCompany ? selectedCompany.code : "ALL";
    const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    const blob = new Blob(["﻿" + content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `payment_report_${scope}_${date}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-5">
      {/* ── การ์ดบริษัท (ปุ่มกรอง) ─────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {companies.map((company) => {
          const theme = themeFor(company.code);
          const isActive = selectedCode === company.code;

          return (
            <button
              key={company.code}
              onClick={() => handleCardClick(company.code)}
              className={`group flex flex-col overflow-hidden rounded-xl border bg-white text-left shadow-sm transition ${
                isActive
                  ? `border-transparent ring-2 ${theme.ring} shadow-md ${theme.activeBg}`
                  : "border-slate-200 hover:border-slate-300 hover:shadow-md"
              }`}
            >
              {/* แถบสีบริษัท */}
              <div className={`h-1 ${theme.bar}`} />

              <div className="flex flex-1 flex-col p-5">
                {/* หัวการ์ด */}
                <div className="flex items-center gap-3">
                  <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${theme.iconBg}`}>
                    <Building2 size={22} className={theme.iconText} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-bold text-slate-800">{company.name}</p>
                    <span className={`mt-0.5 inline-block rounded px-1.5 py-0.5 text-[10px] font-bold ${theme.badge}`}>
                      {company.code}
                    </span>
                  </div>
                  {isActive && (
                    <span className="rounded-full bg-slate-900/5 px-2 py-0.5 text-[10px] font-semibold text-slate-500">
                      ● กำลังดู
                    </span>
                  )}
                </div>

                {/* สถิติ */}
                <div className="mt-4 flex items-end justify-between">
                  <div>
                    <p className="text-3xl font-bold leading-none text-slate-800">
                      {company.count}
                    </p>
                    <p className="mt-1 text-xs text-slate-400">รายการรอโอน</p>
                  </div>
                  <div className="text-right">
                    <p className={`text-lg font-bold leading-none ${theme.amount}`}>
                      {formatCurrency(company.total)}
                    </p>
                    <p className="mt-1 text-xs text-slate-400">ยอดรวม</p>
                  </div>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* ── ตารางรายการ ───────────────────────────────────────────────────── */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        {/* หัวตาราง */}
        <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-4 py-3">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold text-slate-700">
              {selectedCompany ? `จ่ายแล้ว — ${selectedCompany.name}` : "รายการที่จ่ายแล้ว"}
            </h2>
            <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[11px] font-medium text-slate-600">
              {visiblePRs.length} รายการ
            </span>
          </div>
          <div className="flex items-center gap-2">
            {selectedCode && (
              <button
                onClick={() => setSelectedCode(null)}
                className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-slate-500 transition hover:bg-slate-200 hover:text-slate-700"
              >
                <X size={12} /> แสดงทั้งหมด
              </button>
            )}
            {visiblePRs.length > 0 && (
              <>
                <button
                  onClick={() => setShowReport(true)}
                  className="flex items-center gap-1 rounded-md border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-600 transition hover:bg-slate-50"
                >
                  <Eye size={12} /> ดู text
                </button>
                <button
                  onClick={downloadReport}
                  className="flex items-center gap-1 rounded-md bg-slate-700 px-2.5 py-1 text-xs font-medium text-white transition hover:bg-slate-800"
                >
                  <Download size={12} /> ดาวน์โหลด .txt
                </button>
              </>
            )}
          </div>
        </div>

        {visiblePRs.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-14 text-slate-300">
            <Inbox size={28} />
            <p className="text-sm">ยังไม่มีรายการที่จ่ายแล้ว</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="border-b border-slate-100 bg-white">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-slate-500">เลขที่ PR</th>
                  <th className="px-4 py-3 text-left font-medium text-slate-500">ชื่อรายการ</th>
                  <th className="px-4 py-3 text-left font-medium text-slate-500">ผู้ขอ</th>
                  <th className="px-4 py-3 text-left font-medium text-slate-500">บริษัท</th>
                  <th className="px-4 py-3 text-left font-medium text-slate-500 whitespace-nowrap">วันที่จ่าย</th>
                  <th className="px-4 py-3 text-right font-medium text-slate-500 whitespace-nowrap">จำนวนเงิน</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {visiblePRs.map((pr) => {
                  const theme = themeFor(pr.branch_code);
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
                      <td className="px-4 py-3 max-w-[220px]">
                        <span className="block truncate font-medium text-slate-800">{pr.title}</span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-slate-500">
                        {pr.requester_name}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-bold ${theme.badge}`}>
                          {pr.branch_code}
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-xs text-slate-500">
                        {pr.paid_at ? formatDate(pr.paid_at) : "—"}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-green-700 whitespace-nowrap">
                        {formatCurrency(pr.amount)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Modal: ดู text รายงาน ─────────────────────────────────────────── */}
      {showReport && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setShowReport(false)}
        >
          <div
            className="flex max-h-[90vh] w-full max-w-2xl flex-col rounded-2xl bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
              <div>
                <p className="font-semibold text-slate-800">รายงานรายการที่จ่ายแล้ว</p>
                <p className="mt-0.5 text-xs text-slate-500">
                  {selectedCompany ? selectedCompany.name : "ทุกบริษัท"} · {visiblePRs.length} รายการ
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={downloadReport}
                  className="flex items-center gap-1.5 rounded-lg bg-slate-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800"
                >
                  <Download size={14} /> ดาวน์โหลด
                </button>
                <button
                  onClick={() => setShowReport(false)}
                  className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                >
                  <X size={18} />
                </button>
              </div>
            </div>
            <pre className="flex-1 overflow-auto rounded-b-2xl bg-slate-50 p-5 font-mono text-xs leading-5 text-slate-700">
              {buildReportText()}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}
