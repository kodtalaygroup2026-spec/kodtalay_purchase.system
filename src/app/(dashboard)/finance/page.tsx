export const dynamic = "force-dynamic";

import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { formatCurrency } from "@/lib/utils/format";
import { Banknote, Building2, ChevronRight, Inbox } from "lucide-react";

// ── สีประจำแต่ละบริษัท (keyed by branch code) ─────────────────────────────────
const COMPANY_THEME: Record<
  string,
  { bar: string; iconBg: string; iconText: string; badge: string; amount: string }
> = {
  CK:  { bar: "bg-red-500",     iconBg: "bg-red-50",     iconText: "text-red-500",     badge: "bg-red-600 text-white",     amount: "text-red-600" },
  BN:  { bar: "bg-blue-500",    iconBg: "bg-blue-50",    iconText: "text-blue-500",    badge: "bg-blue-600 text-white",    amount: "text-blue-600" },
  RCA: { bar: "bg-emerald-500", iconBg: "bg-emerald-50", iconText: "text-emerald-500", badge: "bg-emerald-600 text-white", amount: "text-emerald-600" },
};

const FALLBACK_THEME = {
  bar: "bg-slate-400", iconBg: "bg-slate-50", iconText: "text-slate-500",
  badge: "bg-slate-600 text-white", amount: "text-slate-700",
};

interface PendingPR {
  id: string;
  pr_number: string;
  title: string;
  amount: number;
  requester_name: string;
}

interface CompanyGroup {
  code: string;
  name: string;
  prs: PendingPR[];
  total: number;
}

export default async function FinancePage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  const isFinance = profile?.role === "finance" || profile?.role === "admin";

  if (!isFinance) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white py-16 text-center">
        <p className="text-slate-500">คุณไม่มีสิทธิ์เข้าถึงหน้านี้</p>
        <p className="mt-1 text-sm text-slate-400">
          เฉพาะฝ่ายการเงินและผู้ดูแลระบบเท่านั้น
        </p>
      </div>
    );
  }

  // ── ดึงบริษัท (สาขา) ทั้งหมด ────────────────────────────────────────────────
  const { data: branchRows } = await (supabase as any)
    .from("branches")
    .select("id, code, name")
    .order("code");

  // ── ดึง PR ที่ส่งมาการเงินแล้ว (pending_finance) ────────────────────────────
  const { data: rawPRs } = await (supabase as any)
    .from("purchase_requisitions")
    .select(
      `id, pr_number, title, total_amount, actual_amount, branch_id,
       profiles!requester_id(full_name)`
    )
    .eq("status", "pending_finance")
    .order("created_at", { ascending: false });

  // ── จัดกลุ่ม PR ตามบริษัท ────────────────────────────────────────────────────
  const groups: CompanyGroup[] = (branchRows ?? []).map((b: any) => {
    const prs: PendingPR[] = (rawPRs ?? [])
      .filter((pr: any) => pr.branch_id === b.id)
      .map((pr: any) => ({
        id: pr.id,
        pr_number: pr.pr_number,
        title: pr.title,
        amount: pr.actual_amount ?? pr.total_amount ?? 0,
        requester_name: pr.profiles?.full_name ?? "—",
      }));
    const total = prs.reduce((sum, pr) => sum + Number(pr.amount), 0);
    return { code: b.code, name: b.name, prs, total };
  });

  const grandTotal = groups.reduce((sum, g) => sum + g.total, 0);
  const grandCount = groups.reduce((sum, g) => sum + g.prs.length, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100">
            <Banknote size={20} className="text-slate-600" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-900">การเงิน</h1>
            <p className="text-sm text-slate-500">
              รายการที่ส่งมายังการเงิน แยกตามบริษัท
            </p>
          </div>
        </div>
        {grandCount > 0 && (
          <div className="hidden text-right sm:block">
            <p className="text-lg font-bold text-slate-800">{formatCurrency(grandTotal)}</p>
            <p className="text-xs text-slate-400">{grandCount} รายการรอโอนทั้งหมด</p>
          </div>
        )}
      </div>

      {/* Company cards */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {groups.map((group) => {
          const theme = COMPANY_THEME[group.code] ?? FALLBACK_THEME;
          const previewPRs = group.prs.slice(0, 4);
          const remaining = group.prs.length - previewPRs.length;

          return (
            <Link
              key={group.code}
              href="/finance/ktb"
              className="group flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition hover:border-slate-300 hover:shadow-md"
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
                    <p className="truncate font-bold text-slate-800">{group.name}</p>
                    <span className={`mt-0.5 inline-block rounded px-1.5 py-0.5 text-[10px] font-bold ${theme.badge}`}>
                      {group.code}
                    </span>
                  </div>
                </div>

                {/* สถิติ */}
                <div className="mt-4 flex items-end justify-between border-b border-slate-100 pb-4">
                  <div>
                    <p className="text-3xl font-bold leading-none text-slate-800">
                      {group.prs.length}
                    </p>
                    <p className="mt-1 text-xs text-slate-400">รายการรอโอน</p>
                  </div>
                  <div className="text-right">
                    <p className={`text-lg font-bold leading-none ${theme.amount}`}>
                      {formatCurrency(group.total)}
                    </p>
                    <p className="mt-1 text-xs text-slate-400">ยอดรวม</p>
                  </div>
                </div>

                {/* รายการ PR ย่อ */}
                <div className="mt-3 flex-1">
                  {previewPRs.length === 0 ? (
                    <div className="flex flex-col items-center justify-center gap-1 py-6 text-slate-300">
                      <Inbox size={22} />
                      <p className="text-xs">ไม่มีรายการรอโอน</p>
                    </div>
                  ) : (
                    <ul className="space-y-2">
                      {previewPRs.map((pr) => (
                        <li key={pr.id} className="flex items-center justify-between gap-2 text-sm">
                          <div className="min-w-0">
                            <span className="font-mono text-[11px] font-bold text-slate-500">
                              {pr.pr_number}
                            </span>
                            <p className="truncate text-xs text-slate-600">{pr.title}</p>
                          </div>
                          <span className="shrink-0 whitespace-nowrap text-xs font-medium text-slate-700">
                            {formatCurrency(pr.amount)}
                          </span>
                        </li>
                      ))}
                      {remaining > 0 && (
                        <li className="pt-0.5 text-[11px] text-slate-400">
                          ··· อีก {remaining} รายการ
                        </li>
                      )}
                    </ul>
                  )}
                </div>

                {/* ลิงก์ */}
                <div className="mt-4 flex items-center justify-end gap-1 text-xs font-medium text-blue-500 opacity-0 transition group-hover:opacity-100">
                  ไปหน้าโอนเงิน KTB <ChevronRight size={13} />
                </div>
              </div>
            </Link>
          );
        })}
      </div>

      {groups.length === 0 && (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white py-16 text-center">
          <p className="text-slate-500">ยังไม่มีข้อมูลบริษัท</p>
        </div>
      )}
    </div>
  );
}
