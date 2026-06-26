import { PiggyBank } from "lucide-react";

export default function PettyCashPage() {
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-slate-800">เงินสดย่อย</h1>
        <p className="text-sm text-slate-500">ยอดคงเหลือและประวัติเงินสดย่อย</p>
      </div>
      <div className="rounded-xl border border-dashed border-slate-300 bg-white py-20 text-center">
        <PiggyBank size={40} className="mx-auto mb-3 text-slate-300" />
        <p className="text-slate-500">ยังไม่มีข้อมูลเงินสดย่อย</p>
        <p className="mt-1 text-xs text-slate-400">กำลังพัฒนา — เร็วๆ นี้</p>
      </div>
    </div>
  );
}
