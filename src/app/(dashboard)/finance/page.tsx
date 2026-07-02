export const dynamic = "force-dynamic";

import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Banknote, Landmark, PiggyBank, FileText, ChevronRight } from "lucide-react";

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

  const isFinance =
    profile?.role === "finance" || profile?.role === "admin";

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

  // นับรายการรอชำระ
  const { count: pendingCount } = await (supabase as any)
    .from("purchase_requisitions")
    .select("id", { count: "exact", head: true })
    .eq("status", "pending_finance");

  const modules = [
    {
      href: "/finance/ktb",
      icon: <Landmark size={24} className="text-blue-500" />,
      bg: "bg-blue-50",
      title: "KTB Smart Transfer",
      desc: "สร้างไฟล์โอนเงิน 3RD Party ส่งให้ธนาคาร KTB",
      badge:
        pendingCount && pendingCount > 0
          ? `${pendingCount} รายการรอโอน`
          : null,
      badgeColor: "bg-amber-100 text-amber-700",
      ready: true,
    },
    {
      href: "/finance/petty-cash",
      icon: <PiggyBank size={24} className="text-emerald-500" />,
      bg: "bg-emerald-50",
      title: "เงินสดย่อย",
      desc: "ยอดคงเหลือและประวัติการเบิกจ่ายเงินสดย่อย",
      badge: null,
      badgeColor: "",
      ready: false,
    },
    {
      href: "/finance/tax-invoices",
      icon: <FileText size={24} className="text-purple-500" />,
      bg: "bg-purple-50",
      title: "ใบกำกับภาษี",
      desc: "ตามเก็บและบันทึกใบกำกับภาษีจากผู้ขาย",
      badge: null,
      badgeColor: "",
      ready: false,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100">
          <Banknote size={20} className="text-slate-600" />
        </div>
        <div>
          <h1 className="text-lg font-bold text-slate-900">การเงิน</h1>
          <p className="text-sm text-slate-500">
            ภาพรวมและเครื่องมือสำหรับฝ่ายการเงิน
          </p>
        </div>
      </div>

      {/* Module cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {modules.map((mod) => (
          <Link
            key={mod.href}
            href={mod.href}
            className="group relative flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-5 transition hover:border-slate-300 hover:shadow-sm"
          >
            <div className="flex items-start justify-between">
              <div
                className={`flex h-12 w-12 items-center justify-center rounded-xl ${mod.bg}`}
              >
                {mod.icon}
              </div>
              {!mod.ready && (
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-400">
                  เร็วๆ นี้
                </span>
              )}
              {mod.badge && (
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${mod.badgeColor}`}
                >
                  {mod.badge}
                </span>
              )}
            </div>

            <div className="flex-1">
              <p className="font-semibold text-slate-800">{mod.title}</p>
              <p className="mt-1 text-sm text-slate-500 leading-relaxed">
                {mod.desc}
              </p>
            </div>

            <div className="flex items-center gap-1 text-xs font-medium text-blue-500 opacity-0 transition group-hover:opacity-100">
              เปิดหน้านี้ <ChevronRight size={13} />
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
