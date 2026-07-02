"use client";

import { useState } from "react";
import Link from "next/link";
import { formatCurrency } from "@/lib/utils/format";
import { Building2, Inbox, X } from "lucide-react";

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

  function handleCardClick(code: string) {
    // คลิกซ้ำที่การ์ดเดิม = ยกเลิกตัวกรอง (กลับไปแสดงทั้งหมด)
    setSelectedCode((prev) => (prev === code ? null : code));
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
              {selectedCompany ? `รายการของ ${selectedCompany.name}` : "รายการทั้งหมด"}
            </h2>
            <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[11px] font-medium text-slate-600">
              {visiblePRs.length} รายการ
            </span>
          </div>
          {selectedCode && (
            <button
              onClick={() => setSelectedCode(null)}
              className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-slate-500 transition hover:bg-slate-200 hover:text-slate-700"
            >
              <X size={12} /> แสดงทั้งหมด
            </button>
          )}
        </div>

        {visiblePRs.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-14 text-slate-300">
            <Inbox size={28} />
            <p className="text-sm">ไม่มีรายการรอโอน</p>
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
                  <th className="px-4 py-3 text-right font-medium text-slate-500 whitespace-nowrap">จำนวนเงิน</th>
                  <th className="w-20 px-3 py-3" />
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
                      <td className="px-4 py-3 text-right font-semibold text-slate-800 whitespace-nowrap">
                        {formatCurrency(pr.amount)}
                      </td>
                      <td className="px-3 py-3 text-right">
                        <Link
                          href="/finance/ktb"
                          className="inline-block rounded-lg bg-blue-600 px-2.5 py-1 text-xs font-medium text-white whitespace-nowrap hover:bg-blue-700"
                        >
                          โอนเงิน
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
