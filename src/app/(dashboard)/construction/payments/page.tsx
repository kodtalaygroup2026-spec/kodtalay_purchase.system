import { Receipt } from "lucide-react";

export default function ConstructionPaymentsPage() {
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-slate-800">ขอเบิก / ตรวจรับงาน</h1>
        <p className="text-sm text-slate-500">รายการขอเบิกและตรวจรับงานก่อสร้าง</p>
      </div>
      <div className="rounded-xl border border-dashed border-slate-300 bg-white py-20 text-center">
        <Receipt size={40} className="mx-auto mb-3 text-slate-300" />
        <p className="text-slate-500">ยังไม่มีรายการขอเบิก</p>
        <p className="mt-1 text-xs text-slate-400">กำลังพัฒนา — เร็วๆ นี้</p>
      </div>
    </div>
  );
}
