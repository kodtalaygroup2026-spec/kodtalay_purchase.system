import Link from "next/link";
import { Plus, HardHat } from "lucide-react";

export default function ConstructionPage() {
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-800">งานก่อสร้าง</h1>
          <p className="text-sm text-slate-500">รายการงานก่อสร้างทั้งหมด</p>
        </div>
        <Link
          href="/construction/new"
          className="flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-violet-700"
        >
          <Plus size={16} />
          เปิดงานใหม่
        </Link>
      </div>

      <div className="rounded-xl border border-dashed border-slate-300 bg-white py-20 text-center">
        <HardHat size={40} className="mx-auto mb-3 text-slate-300" />
        <p className="text-slate-500">ยังไม่มีงานก่อสร้าง</p>
        <p className="mt-1 text-xs text-slate-400">กำลังพัฒนา — เร็วๆ นี้</p>
        <Link
          href="/construction/new"
          className="mt-4 inline-flex items-center gap-1 text-sm text-violet-600 hover:underline"
        >
          <Plus size={14} /> เปิดงานแรก
        </Link>
      </div>
    </div>
  );
}
