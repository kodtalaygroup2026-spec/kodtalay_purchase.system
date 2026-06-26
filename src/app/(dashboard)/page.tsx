import { APP_NAME } from "@/lib/constants";
import Link from "next/link";
import { ShoppingCart, HardHat, ArrowRight, FileText, Package, Banknote } from "lucide-react";

export default function HomePage() {
  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center gap-8 px-4">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-slate-800">{APP_NAME}</h1>
        <p className="mt-1 text-sm text-slate-500">เลือกโมดูลที่ต้องการใช้งาน</p>
      </div>

      <div className="grid w-full max-w-2xl grid-cols-1 gap-4 sm:grid-cols-2">
        {/* จัดซื้อทั่วไป */}
        <Link
          href="/requisitions"
          className="group relative flex flex-col gap-4 overflow-hidden rounded-2xl border-2 border-emerald-200 bg-white p-6 shadow-sm transition-all hover:border-emerald-400 hover:shadow-md"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-100">
              <ShoppingCart size={24} className="text-emerald-600" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-800">จัดซื้อทั่วไป</h2>
              <p className="text-xs text-slate-500">ด่วน / ไม่ด่วน</p>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Step icon={FileText} label="ขอ PR" color="text-emerald-600" />
            <Step icon={Package} label="ซื้อของ + GR" color="text-emerald-600" />
            <Step icon={Banknote} label="อนุมัติและจ่าย" color="text-emerald-600" />
          </div>

          <div className="flex items-center gap-1 text-sm font-medium text-emerald-600 group-hover:gap-2 transition-all">
            เข้าสู่ระบบจัดซื้อ <ArrowRight size={16} />
          </div>

          <div className="absolute right-0 top-0 h-full w-1 bg-emerald-500 opacity-0 transition-opacity group-hover:opacity-100" />
        </Link>

        {/* ก่อสร้าง */}
        <Link
          href="/construction"
          className="group relative flex flex-col gap-4 overflow-hidden rounded-2xl border-2 border-violet-200 bg-white p-6 shadow-sm transition-all hover:border-violet-400 hover:shadow-md"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-violet-100">
              <HardHat size={24} className="text-violet-600" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-800">ก่อสร้าง</h2>
              <p className="text-xs text-slate-500">จ่ายจบ</p>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Step icon={FileText} label="Ticket + BOQ" color="text-violet-600" />
            <Step icon={Package} label="ขอเบิก + ตรวจรับ" color="text-violet-600" />
            <Step icon={Banknote} label="อนุมัติและจ่าย" color="text-violet-600" />
          </div>

          <div className="flex items-center gap-1 text-sm font-medium text-violet-600 group-hover:gap-2 transition-all">
            เข้าสู่ระบบก่อสร้าง <ArrowRight size={16} />
          </div>

          <div className="absolute right-0 top-0 h-full w-1 bg-violet-500 opacity-0 transition-opacity group-hover:opacity-100" />
        </Link>
      </div>

      <p className="text-xs text-slate-400">ทุกการดำเนินการบันทึก audit trail อัตโนมัติ</p>
    </div>
  );
}

function Step({
  icon: Icon,
  label,
  color,
}: {
  icon: React.ElementType;
  label: string;
  color: string;
}) {
  return (
    <div className="flex items-center gap-2 text-sm text-slate-600">
      <Icon size={13} className={color} />
      {label}
    </div>
  );
}
