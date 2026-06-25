import { createClient } from "@/lib/supabase/server";
import { APP_NAME, APP_VERSION, PR_STATUS_LABELS } from "@/lib/constants";
import { formatCurrency } from "@/lib/utils/format";
import Link from "next/link";
import { FileText, ShoppingCart, CheckSquare, Truck, Users, Package } from "lucide-react";

const MODULES = [
  {
    href: "/requisitions",
    icon: FileText,
    title: "ใบขอซื้อ (PR)",
    desc: "สร้างและติดตามใบขอซื้อ",
    color: "text-blue-600",
    bg: "bg-blue-50",
  },
  {
    href: "/orders",
    icon: ShoppingCart,
    title: "ใบสั่งซื้อ (PO)",
    desc: "ออกและจัดการใบสั่งซื้อ",
    color: "text-indigo-600",
    bg: "bg-indigo-50",
  },
  {
    href: "/approvals",
    icon: CheckSquare,
    title: "การอนุมัติ",
    desc: "รายการรออนุมัติของฉัน",
    color: "text-amber-600",
    bg: "bg-amber-50",
  },
  {
    href: "/receipts",
    icon: Truck,
    title: "รับของ (GR)",
    desc: "บันทึกการรับสินค้า",
    color: "text-green-600",
    bg: "bg-green-50",
  },
  {
    href: "/suppliers",
    icon: Users,
    title: "ผู้ขาย",
    desc: "จัดการข้อมูลคู่ค้า",
    color: "text-purple-600",
    bg: "bg-purple-50",
  },
  {
    href: "/products",
    icon: Package,
    title: "สินค้า",
    desc: "แคตตาล็อกสินค้า/บริการ",
    color: "text-rose-600",
    bg: "bg-rose-50",
  },
];

export default async function HomePage() {
  const supabase = await createClient();

  const [
    { count: prPendingCount },
    { data: recentPRs },
  ] = await Promise.all([
    supabase
      .from("purchase_requisitions")
      .select("*", { count: "exact", head: true })
      .eq("status", "submitted"),
    supabase
      .from("purchase_requisitions")
      .select("id, pr_number, title, status, total_amount, created_at")
      .order("created_at", { ascending: false })
      .limit(5),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-800">{APP_NAME}</h1>
        <p className="text-sm text-slate-500">เวอร์ชัน {APP_VERSION}</p>
      </div>

      {/* สรุปสถานะ */}
      {prPendingCount !== null && prPendingCount > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-5 py-4">
          <p className="text-sm font-medium text-amber-800">
            มี <span className="font-bold">{prPendingCount}</span> ใบขอซื้อรออนุมัติ
          </p>
          <Link
            href="/approvals"
            className="mt-1 text-xs text-amber-700 underline underline-offset-2"
          >
            ดูรายการอนุมัติ →
          </Link>
        </div>
      )}

      {/* เมนูโมดูล */}
      <section>
        <h2 className="mb-3 text-sm font-semibold text-slate-500 uppercase tracking-wide">
          เมนูหลัก
        </h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {MODULES.map((m) => (
            <Link
              key={m.href}
              href={m.href}
              className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-blue-300 hover:shadow-md"
            >
              <div className={`mt-0.5 rounded-lg p-2 ${m.bg}`}>
                <m.icon size={18} className={m.color} />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-slate-800">{m.title}</h3>
                <p className="mt-0.5 text-xs text-slate-500">{m.desc}</p>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* PR ล่าสุด */}
      {recentPRs && recentPRs.length > 0 && (
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide">
              ใบขอซื้อล่าสุด
            </h2>
            <Link href="/requisitions" className="text-xs text-blue-600 hover:underline">
              ดูทั้งหมด →
            </Link>
          </div>
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <table className="min-w-full text-sm">
              <thead className="border-b border-slate-100 bg-slate-50">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-slate-500">เลขที่</th>
                  <th className="px-4 py-3 text-left font-medium text-slate-500">ชื่อ</th>
                  <th className="px-4 py-3 text-right font-medium text-slate-500">มูลค่า</th>
                  <th className="px-4 py-3 text-center font-medium text-slate-500">สถานะ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {recentPRs.map((pr) => (
                  <tr key={pr.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <Link
                        href={`/requisitions/${pr.id}`}
                        className="font-mono text-xs text-blue-600 hover:underline"
                      >
                        {pr.pr_number}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-slate-700 max-w-[200px] truncate">
                      {pr.title}
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-slate-800">
                      {formatCurrency(pr.total_amount)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                        {PR_STATUS_LABELS[pr.status as keyof typeof PR_STATUS_LABELS] ?? pr.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
