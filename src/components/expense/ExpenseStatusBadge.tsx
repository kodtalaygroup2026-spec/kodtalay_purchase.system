import { EXPENSE_STATUS_LABELS } from "@/lib/constants";
import type { ExpenseStatus } from "@/types/database";

const STATUS_STYLES: Record<ExpenseStatus, string> = {
  draft: "bg-slate-100 text-slate-600",
  submitted: "bg-amber-100 text-amber-700",
  approved: "bg-blue-100 text-blue-700",
  rejected: "bg-red-100 text-red-700",
  paid: "bg-green-100 text-green-700",
  cancelled: "bg-slate-100 text-slate-400",
};

interface ExpenseStatusBadgeProps {
  status: ExpenseStatus;
}

export function ExpenseStatusBadge({ status }: ExpenseStatusBadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLES[status]}`}
    >
      {EXPENSE_STATUS_LABELS[status]}
    </span>
  );
}
