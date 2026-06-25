import { createClient } from "@/lib/supabase/server";
import { APP_NAME, APP_VERSION, PR_STATUS_LABELS } from "@/lib/constants";
import { formatCurrency } from "@/lib/utils/format";
import Link from "next/link";
import { FileText, ShoppingCart, CheckSquare, Truck, Users, Package } from "lucide-react";

export default async function HomePage() {
  const supabase = await createClient();

  // ดึงข้อมูลทั้งหมดพร้อมกัน
  const [
    { count: prCount },
    { count: poCount },
    { count: approvalsCount },
    { count: grCount },
    { count: suppliersCount },
    { count: productsCount },
    { data: recentPRs },
  ] = await Promise.all([
    supabase.from("purchase_requisitions").select("*", { count: "exact", head: true }),
    supabase.from("purchase_orders").select("*", { count: "exact", head: true }),
    supabase
      .from("purchase_requisitions")
      .select("*", { count: "exact", head: true })
      .eq("status", "submitted"),
    supabase.from("goods_receipts").select("*", { count: "exact", head: true }),
    supabase
      .from("suppliers")
      .select("*", { count: "exact", head: true })
      .eq("is_active", true),
    supabase
      .from("products")
      .select("*", { count: "exact", head: true })
      .eq("is_active", true),
    supabase
      .from("purchase_requisitions")
      .select("id, pr_number, title, status, total_amount, created_at")
      .order("created_at", { ascending: false })
      .limit(5),
  ]);

  const MODULES = [
    {
      href: "/requisitions",
      icon: FileText,
      title: "ใบขอซื้อ (PR)",
      desc: "สร้างและติดตามใบขอซื้อ",
      color: "text-blue-600",
      bg: "bg-blue-50",
      badgeBg: "bg-blue-600",
      count: prCount ?? 0,
    },
    {
      href: "/orders",
      icon: ShoppingCart,
      title: "ใบสั่งซื้อ (PO)",
      desc: "ออกและจัดการใบสั่งซื้อ",
      color: "text-indigo-600",
      bg: "bg-indigo-50",
      badgeBg: "bg-indigo-600",
      count: poCount ?? 0,
    },
    {
      href: "/approvals",
      icon: CheckSquare,
      title: "การอนุมัติ",
      desc: "รายการรออนุมัติของฉัน",
      color: "text-amber-600",
      bg: "bg-amber-50",
      badgeBg: "bg-amber-500",
      count: approvalsCount ?? 0,
    },
    {
      href: "/receipts",
      icon: Truck,
      title: "รับของ (GR)",
      desc: "บันทึกการรับสินค้า",
      color: "text-green-600",
      bg: "bg-green-50",
      badgeBg: "bg-green-600",
      count: grCount ?? 0,
    },
    {
      href: "/suppliers",
      icon: Users,
      title: "ผู้ขาย",
      desc: "จัดการข้อมูลคู่ค้า",
      color: "text-purple-600",
      bg: "bg-purple-50",
      badgeBg: "bg-purple-600",
      count: suppliersCount ?? 0,
    },
    {
      href: "/products",
      icon: Package,
      title: "สินค้า",
      desc: "แคตตาล็อกสินค้า/บริการ",
      color: "text-rose-600",
      bg: "bg-rose-50",
      badgeBg: "bg-rose-600",
      count: productsCount ?? 0,
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-800">{APP_NAME}</h1>
        <p className="text-sm text-slate-500">เวอร์ชัน {APP_VERSION}</p>
      </div>

      {/* แจ้งเตือนรออนุมัติ */}
      {(approvalsCount ?? 0) > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-5 py-4">
          <p className="text-sm font-medium text-amber-800">
            มี <span className="font-bold">{approvalsCount}</span> ใบขอซื้อรออนุมัติ
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
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
          เมนูหลัก
        </h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {MODULES.map((m) => (
            <Link
              key={m.href}
              href={m.href}
              className="relative flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-blue-300 hover:shadow-md"
            >
              {/* badge ตัวเลข */}
              {m.count > 0 && (
                <span
                  className={`absolute right-3 top-3 min-w-[22px] rounded-full px-1.5 py-0.5 text-center text-xs font-bold text-white ${m.badgeBg}`}
                >
                  {m.count > 99 ? "99+" : m.count}
                </span>
              )}

              <div className={`mt-0.5 shrink-0 rounded-lg p-2 ${m.bg}`}>
                <m.icon size={18} className={m.color} />
              </div>
              <div className="min-w-0 pr-6">
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
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
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
                    <td className="max-w-[200px] truncate px-4 py-3 text-slate-700">
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
