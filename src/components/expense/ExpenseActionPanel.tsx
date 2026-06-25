"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle, XCircle, Banknote, Ban } from "lucide-react";
import {
  approveExpense,
  rejectExpense,
  markAsPaid,
  cancelExpense,
  submitExpense,
} from "@/lib/expense/actions";
import type { ExpenseStatus, UserRole } from "@/types/database";

interface ExpenseActionPanelProps {
  expenseId: string;
  status: ExpenseStatus;
  requesterId: string;
  currentUserId: string;
  currentUserRole: UserRole;
}

export function ExpenseActionPanel({
  expenseId,
  status,
  requesterId,
  currentUserId,
  currentUserRole,
}: ExpenseActionPanelProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [comment, setComment] = useState("");
  const [paymentDate, setPaymentDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [error, setError] = useState<string | null>(null);

  const isRequester = requesterId === currentUserId;
  const isManagerOrAdmin = currentUserRole === "admin" || currentUserRole === "manager";
  const isAdminOrPurchaser =
    currentUserRole === "admin" || currentUserRole === "purchaser";

  function run(action: () => Promise<void>) {
    setError(null);
    startTransition(async () => {
      try {
        await action();
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "เกิดข้อผิดพลาด");
      }
    });
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
        {error}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* ผู้ขอ: ส่งอนุมัติ (draft) */}
      {status === "draft" && isRequester && (
        <button
          disabled={isPending}
          onClick={() => run(() => submitExpense(expenseId))}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
        >
          <CheckCircle size={16} />
          ส่งขออนุมัติ
        </button>
      )}

      {/* ผู้อนุมัติ: อนุมัติ / ปฏิเสธ (submitted) */}
      {status === "submitted" && isManagerOrAdmin && (
        <>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="ความเห็น (ถ้ามี)"
            rows={2}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
          />
          <div className="grid grid-cols-2 gap-2">
            <button
              disabled={isPending}
              onClick={() => run(() => approveExpense(expenseId, comment))}
              className="flex items-center justify-center gap-1.5 rounded-xl bg-green-600 py-2.5 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-60"
            >
              <CheckCircle size={15} />
              อนุมัติ
            </button>
            <button
              disabled={isPending}
              onClick={() => run(() => rejectExpense(expenseId, comment))}
              className="flex items-center justify-center gap-1.5 rounded-xl bg-red-500 py-2.5 text-sm font-medium text-white hover:bg-red-600 disabled:opacity-60"
            >
              <XCircle size={15} />
              ปฏิเสธ
            </button>
          </div>
        </>
      )}

      {/* admin/purchaser: บันทึกการจ่าย (approved) */}
      {status === "approved" && isAdminOrPurchaser && (
        <>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">
              วันที่จ่าย
            </label>
            <input
              type="date"
              value={paymentDate}
              onChange={(e) => setPaymentDate(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
            />
          </div>
          <button
            disabled={isPending}
            onClick={() => run(() => markAsPaid(expenseId, paymentDate))}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-green-600 py-2.5 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-60"
          >
            <Banknote size={16} />
            บันทึกการจ่ายเงิน
          </button>
        </>
      )}

      {/* ผู้ขอ หรือ admin: ยกเลิก (draft/submitted) */}
      {(status === "draft" || status === "submitted") &&
        (isRequester || currentUserRole === "admin") && (
          <button
            disabled={isPending}
            onClick={() => run(() => cancelExpense(expenseId))}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 py-2.5 text-sm text-slate-500 hover:bg-slate-50 disabled:opacity-60"
          >
            <Ban size={16} />
            ยกเลิกใบเบิก
          </button>
        )}
    </div>
  );
}
