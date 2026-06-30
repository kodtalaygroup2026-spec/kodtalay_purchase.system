"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { DEPARTMENTS } from "@/lib/constants";
import { Building2 } from "lucide-react";

interface DepartmentSelectorProps {
  userId: string;
  initialDepartment: string | null;
}

export function DepartmentSelector({ userId, initialDepartment }: DepartmentSelectorProps) {
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

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-3 flex items-center gap-2">
        <Building2 size={16} className="text-slate-400" />
        <h3 className="font-semibold text-slate-700">แผนก</h3>
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
      <div className="mt-2 h-4 text-xs">
        {status === "saving" && <span className="text-slate-400">กำลังบันทึก...</span>}
        {status === "saved"  && <span className="text-green-600 font-medium">✓ บันทึกแล้ว</span>}
        {status === "error"  && <span className="text-red-500">เกิดข้อผิดพลาด กรุณาลองใหม่</span>}
      </div>
    </div>
  );
}
