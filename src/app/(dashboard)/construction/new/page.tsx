import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default function NewConstructionPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <div className="flex items-center gap-3">
        <Link href="/construction" className="text-slate-400 hover:text-slate-600">
          <ArrowLeft size={20} />
        </Link>
        <h1 className="text-xl font-bold text-slate-800">เปิดงานก่อสร้างใหม่</h1>
      </div>
      <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-slate-400 shadow-sm">
        กำลังพัฒนา — เร็วๆ นี้
      </div>
    </div>
  );
}
