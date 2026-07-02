"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { DEPARTMENTS } from "@/lib/constants";
import { Building2 } from "lucide-react";

interface DepartmentSelectorProps {
  userId: string;
  initialDepartment: string | null;
  compact?: boolean; // เมื่อ true: ไม่มี card wrapper (ใช้ภายใน ProfilePage)
}

export function DepartmentSelector({ userId, initialDepartment, compact = false }: DepartmentSelectorProps) {
  const supabase = createClient();
  const [department, setDepartment] = useState(initialDepartment ?? "");
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");

  async function handleChange(value: string) {
    setDepartment(value);
    setStatus("saving");

    const { error } = await supabase
      .from("profiles")
      .update({ department: value || null })
      .eq("id", userId);

    if (error) {
      setStatus("error");
      setTimeout(() => setStatus("idle"), 3000);
    } else {
      setStatus("saved");
      setTimeout(() => setStatus("idle"), 2000);
    }
  }

  const inner = (
    <div>
      <div className="mb-2 flex items-center gap-2">
        <Building2 size={14} className="text-slate-400" />
        <span className="text-xs font-semibold text-slate-600">แผนก</span>
      </div>
      <select
        value={department}
        onChange={(e) => handleChange(e.target.value)}
        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 focus:border-blue-500 focus:outline-none"
      >
        <option value="">— ยังไม่ได้เลือกแผนก —</option>
        {DEPARTMENTS.map((dept) => (
          <option key={dept} value={dept}>{dept}</option>
        ))}
      </select>
      <div className="mt-1.5 h-4 text-xs">
        {status === "saving" && <span className="text-slate-400">กำลังบันทึก...</span>}
        {status === "saved"  && <span className="text-green-600 font-medium">✓ บันทึกแล้ว</span>}
        {status === "error"  && <span className="text-red-500">เกิดข้อผิดพลาด กรุณาลองใหม่</span>}
      </div>
    </div>
  );

  if (compact) return inner;
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">{inner}</div>
  );
}
