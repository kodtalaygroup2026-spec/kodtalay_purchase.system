// ===========================================================================
// File: src/app/page.tsx
// คำอธิบาย: หน้าแรก/แดชบอร์ด (Server Component) — แสดงข้อมูลผู้ใช้ที่ล็อกอิน
//          และเมนูหลักของระบบจัดซื้อ ข้อมูลถูกดึงฝั่ง server เพื่อความเร็ว
// ===========================================================================
import { createClient } from "@/lib/supabase/server";
import { APP_NAME, APP_VERSION } from "@/lib/constants";

// เมนูหลักของระบบ (scaffold — แต่ละหน้าจะถูกพัฒนาในรอบถัดไป)
const MODULES = [
  { href: "/requisitions", title: "ใบขอซื้อ (PR)", desc: "สร้างและติดตามใบขอซื้อ" },
  { href: "/orders", title: "ใบสั่งซื้อ (PO)", desc: "ออกและจัดการใบสั่งซื้อ" },
  { href: "/suppliers", title: "ผู้ขาย", desc: "จัดการข้อมูลคู่ค้า" },
  { href: "/products", title: "สินค้า", desc: "แคตตาล็อกสินค้า/บริการ" },
  { href: "/receipts", title: "รับของ", desc: "บันทึกการรับสินค้า" },
  { href: "/approvals", title: "การอนุมัติ", desc: "รายการรออนุมัติ" },
];

export default async function HomePage() {
  const supabase = await createClient();

  // ดึงข้อมูลผู้ใช้ปัจจุบัน (middleware จัดการ redirect ไป /login ให้แล้วถ้ายังไม่ล็อกอิน)
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <header className="mb-8">
        <h1 className="text-2xl font-bold text-brand">{APP_NAME}</h1>
        <p className="text-sm text-slate-500">
          เวอร์ชัน {APP_VERSION} · ผู้ใช้: {user?.email ?? "ไม่ทราบ"}
        </p>
      </header>

      {/* เมนูโมดูลหลัก */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {MODULES.map((m) => (
          <a
            key={m.href}
            href={m.href}
            className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-brand hover:shadow-md"
          >
            <h2 className="font-semibold text-slate-800">{m.title}</h2>
            <p className="mt-1 text-sm text-slate-500">{m.desc}</p>
          </a>
        ))}
      </section>
    </main>
  );
}
