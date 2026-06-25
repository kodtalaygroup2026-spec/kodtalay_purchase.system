// ===========================================================================
// File: src/components/ui/StatusBadge.tsx
// คำอธิบาย: ป้ายแสดงสถานะ (badge) สีตามสถานะ ใช้ซ้ำได้ทั้งระบบ
// ===========================================================================
import { PO_STATUS_LABELS, PR_STATUS_LABELS } from "@/lib/constants";
import type { PoStatus, PrStatus } from "@/types/database";

// แมปสถานะ → คลาสสี (Tailwind)
const COLOR: Record<string, string> = {
  draft: "bg-slate-100 text-slate-700",
  submitted: "bg-amber-100 text-amber-800",
  pending_approval: "bg-amber-100 text-amber-800",
  approved: "bg-green-100 text-green-800",
  sent: "bg-blue-100 text-blue-800",
  partially_received: "bg-indigo-100 text-indigo-800",
  received: "bg-green-100 text-green-800",
  converted: "bg-green-100 text-green-800",
  closed: "bg-slate-200 text-slate-700",
  rejected: "bg-red-100 text-red-800",
  cancelled: "bg-red-100 text-red-800",
};

type Props =
  | { kind: "pr"; status: PrStatus }
  | { kind: "po"; status: PoStatus };

export function StatusBadge(props: Props) {
  const label =
    props.kind === "pr"
      ? PR_STATUS_LABELS[props.status]
      : PO_STATUS_LABELS[props.status];
  const color = COLOR[props.status] ?? "bg-slate-100 text-slate-700";

  return (
    <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${color}`}>
      {label}
    </span>
  );
}
