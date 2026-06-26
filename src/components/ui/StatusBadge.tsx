// ===========================================================================
// File: src/components/ui/StatusBadge.tsx
// คำอธิบาย: ป้ายแสดงสถานะ (badge) สีตามสถานะ ใช้ซ้ำได้ทั้งระบบ
// ===========================================================================
import {
  CONSTRUCTION_STATUS_LABELS,
  PAYMENT_STATUS_LABELS,
  PO_STATUS_LABELS,
  PR_STATUS_LABELS,
} from "@/lib/constants";
import type {
  ConstructionStatus,
  PaymentRequestStatus,
  PoStatus,
  PrStatus,
} from "@/types/database";

// แมปสถานะ → คลาสสี (Tailwind)
const COLOR: Record<string, string> = {
  draft: "bg-slate-100 text-slate-700",
  open: "bg-slate-100 text-slate-700",
  submitted: "bg-amber-100 text-amber-800",
  pending_approval: "bg-amber-100 text-amber-800",
  boq_pending: "bg-amber-100 text-amber-800",
  payment_pending: "bg-amber-100 text-amber-800",
  pending_second_approval: "bg-orange-100 text-orange-800",
  pending: "bg-amber-100 text-amber-800",
  approved: "bg-green-100 text-green-800",
  boq_approved: "bg-blue-100 text-blue-800",
  payment_approved: "bg-green-100 text-green-800",
  inspected: "bg-blue-100 text-blue-800",
  sent: "bg-blue-100 text-blue-800",
  partially_received: "bg-indigo-100 text-indigo-800",
  received: "bg-green-100 text-green-800",
  converted: "bg-green-100 text-green-800",
  closed: "bg-slate-200 text-slate-700",
  rejected: "bg-red-100 text-red-800",
  cancelled: "bg-red-100 text-red-800",
  returned: "bg-orange-100 text-orange-800",
};

type Props =
  | { kind: "pr"; status: PrStatus }
  | { kind: "po"; status: PoStatus }
  | { kind: "construction"; status: ConstructionStatus }
  | { kind: "payment"; status: PaymentRequestStatus };

export function StatusBadge(props: Props) {
  let label: string;
  if (props.kind === "pr") label = PR_STATUS_LABELS[props.status];
  else if (props.kind === "po") label = PO_STATUS_LABELS[props.status];
  else if (props.kind === "construction") label = CONSTRUCTION_STATUS_LABELS[props.status];
  else label = PAYMENT_STATUS_LABELS[props.status];

  const color = COLOR[props.status] ?? "bg-slate-100 text-slate-700";

  return (
    <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${color}`}>
      {label}
    </span>
  );
}
