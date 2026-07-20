// ===========================================================================
// File: src/components/shared/BranchBadge.tsx
// คำอธิบาย: ป้ายบริษัท/สาขา มาตรฐานเดียวทั้งระบบ (สีตามรหัสสาขา)
// ===========================================================================

const BRANCH_COLORS: Record<string, string> = {
  BN: "bg-blue-600",
  CK: "bg-red-600",
  RCA: "bg-emerald-600",
};

interface BranchBadgeProps {
  code?: string | null;
  /** ข้อความบนป้าย — ไม่ระบุ = ใช้รหัสสาขา */
  label?: string | null;
  /** sm = ในตาราง (ค่าเริ่มต้น) / md = หัวเอกสาร */
  size?: "sm" | "md";
}

export function BranchBadge({ code, label, size = "sm" }: BranchBadgeProps) {
  if (!code) return <span className="text-xs text-slate-300">—</span>;

  const sizeCls =
    size === "md" ? "rounded-lg px-2.5 py-0.5 text-xs" : "rounded px-1.5 py-0.5 text-[10px]";

  return (
    <span
      className={`inline-flex items-center font-bold text-white ${sizeCls} ${
        BRANCH_COLORS[code] ?? "bg-slate-500"
      }`}
    >
      {label ?? code}
    </span>
  );
}
