"use client";

import { useState } from "react";
import Link from "next/link";
import { formatCurrency, formatDate } from "@/lib/utils/format";
import { Inbox, Building2, Wallet } from "lucide-react";

const BRANCH_BADGE: Record<string, string> = {
  CK: "bg-red-600 text-white", BN: "bg-blue-600 text-white", RCA: "bg-emerald-600 text-white",
};
const branchBadge = (code: string) => BRANCH_BADGE[code] ?? "bg-slate-600 text-white";

export interface DocRow {
  id: string;
  pr_number: string;
  title: string;
  amount: number;
  branch_code: string;
  requester_name: string;
  paid_at: string | null;
  payment_channel: "company" | "petty_cash" | null;
  close_status: "complete" | "incomplete" | null;
}

interface Props {
  docs: DocRow[];
}

type Tab = "all" | "complete" | "incomplete";

const TABS: { key: Tab; label: string }[] = [
  { key: "all",        label: "ทั้งหมด" },
  { key: "complete",   label: "✅ สมบูรณ์" },
  { key: "incomplete", label: "⚠️ ไม่สมบูรณ์" },
];

export function FinanceDocumentsList({ docs }: Props) {
  const [tab, setTab] = useState<Tab>("all");

  const counts = {
    all: docs.length,
    complete: docs.filter((d) => d.close_status === "complete").length,
    incomplete: docs.filter((d) => d.close_status === "incomplete").length,
  };

  const visible =
    tab === "all" ? docs : docs.filter((d) => d.close_status === tab);

  return (
    <div className="space-y-4">
      {/* แท็บ */}
      <div className="flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium transition ${
              tab === t.key
                ? "border-slate-700 bg-slate-700 text-white"
                : "border-slate-200 bg-white text-slate-500 hover:border-slate-300"
            }`}
          >
            {t.label}
            <span className={`rounded-full px-1.5 text-[10px] font-bold ${
              tab === t.key ? "bg-white/20 text-white" : "bg-slate-100 text-slate-500"
            }`}>{counts[t.key]}</span>
          </button>
        ))}
      </div>

      {/* ตาราง */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        {visible.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-14 text-slate-300">
            <Inbox size={28} />
            <p className="text-sm">ไม่มีเอกสารในหมวดนี้</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="border-b border-slate-100 bg-slate-50">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-slate-500">เลขที่ PR</th>
                  <th className="px-4 py-3 text-left font-medium text-slate-500">ชื่อรายการ</th>
                  <th className="px-4 py-3 text-left font-medium text-slate-500">ผู้ขอ</th>
                  <th className="px-4 py-3 text-left font-medium text-slate-500">บริษัท</th>
                  <th className="px-4 py-3 text-left font-medium text-slate-500">ช่องทาง</th>
                  <th className="px-4 py-3 text-left font-medium text-slate-500 whitespace-nowrap">วันที่จ่าย</th>
                  <th className="px-4 py-3 text-left font-medium text-slate-500">เอกสาร</th>
                  <th className="px-4 py-3 text-right font-medium text-slate-500 whitespace-nowrap">ยอด</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {visible.map((d) => (
                  <tr key={d.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <Link href={`/requisitions/${d.id}`} className="font-mono text-xs font-bold text-blue-600 hover:underline">
                        {d.pr_number}
                      </Link>
                    </td>
                    <td className="px-4 py-3 max-w-[200px]">
                      <span className="block truncate font-medium text-slate-800">{d.title}</span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-slate-500">{d.requester_name}</td>
                    <td className="px-4 py-3">
                      <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${branchBadge(d.branch_code)}`}>
                        {d.branch_code}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {d.payment_channel === "petty_cash" ? (
                        <span className="inline-flex items-center gap-1 text-xs text-emerald-600">
                          <Wallet size={12} /> เงินสดย่อย
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs text-blue-600">
                          <Building2 size={12} /> บริษัท
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-xs text-slate-500">
                      {d.paid_at ? formatDate(d.paid_at) : "—"}
                    </td>
                    <td className="px-4 py-3">
                      {d.close_status === "complete" ? (
                        <span className="rounded-full bg-green-100 px-2 py-0.5 text-[11px] font-semibold text-green-700">✅ สมบูรณ์</span>
                      ) : d.close_status === "incomplete" ? (
                        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-700">⚠️ ค้างเอกสาร</span>
                      ) : (
                        <span className="text-xs text-slate-300">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-slate-800 whitespace-nowrap">
                      {formatCurrency(d.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
