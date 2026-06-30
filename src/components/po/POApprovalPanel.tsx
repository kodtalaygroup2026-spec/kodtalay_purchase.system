"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { PoStatus, UserRole } from "@/types/database";
import { CheckCircle, XCircle, Send, X } from "lucide-react";

interface POApprovalPanelProps {
  po: {
    id: string;
    status: PoStatus;
    created_by: string;
    pr_id: string | null;
  };
  currentUserId: string;
  currentUserRole: UserRole | undefined;
}

export function POApprovalPanel({ po, currentUserId, currentUserRole }: POApprovalPanelProps) {
  const router = useRouter();
  const supabase = createClient();
  const [isLoading, setIsLoading] = useState(false);
  const [note, setNote] = useState("");
  const [showNoteInput, setShowNoteInput] = useState(false);
  const [pendingAction, setPendingAction] = useState<"approve" | "reject" | null>(null);

  const isOwner = currentUserId === po.created_by;
  const isApprover = currentUserRole === "manager" || currentUserRole === "admin";

  const canSubmit = isOwner && po.status === "draft";
  const canApprove = isApprover && po.status === "pending_approval";
  // PO ถูกส่งแล้ว (pending_approval) ถือว่าเข้าสู่กระบวนการ — ไม่มีปุ่มยกเลิกอีก
  const canCancel = false;

  async function updatePoStatus(status: string, audit: Record<string, string | null> = {}) {
    const { error } = await (supabase as any)
      .from("purchase_orders")
      .update({ status, ...audit })
      .eq("id", po.id);
    if (error) return;

    // เมื่อ PO ได้รับการอนุมัติ → อัปเดต PR ที่เชื่อมอยู่เป็น 'converted'
    if (status === "approved" && po.pr_id) {
      await (supabase as any)
        .from("purchase_requisitions")
        .update({ status: "converted" })
        .eq("id", po.pr_id);
    }

    router.refresh();
  }

  async function handleSubmit() {
    setIsLoading(true);
    const now = new Date().toISOString();
    await updatePoStatus("pending_approval", {
      submitted_at: now,
      submitted_by: currentUserId,
    });
    setIsLoading(false);
  }

  async function handleCancel() {
    setIsLoading(true);
    const now = new Date().toISOString();
    await updatePoStatus("cancelled", {
      cancelled_at: now,
      cancelled_by: currentUserId,
    });
    setIsLoading(false);
  }

  function askAction(action: typeof pendingAction) {
    setShowNoteInput(true);
    setPendingAction(action);
    setNote("");
  }

  function cancelNote() {
    setShowNoteInput(false);
    setPendingAction(null);
    setNote("");
  }

  async function confirmAction() {
    if (!pendingAction) return;
    setIsLoading(true);
    const now = new Date().toISOString();

    if (pendingAction === "approve") {
      await updatePoStatus("approved", {
        approved_at: now,
        approved_by: currentUserId,
      });
    } else {
      await updatePoStatus("cancelled", {
        cancelled_at: now,
        cancelled_by: currentUserId,
      });
    }

    setIsLoading(false);
    cancelNote();
  }

  if (!canSubmit && !canApprove && !canCancel) return null;

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <h3 className="mb-4 font-semibold text-slate-700">การดำเนินการ</h3>

      {showNoteInput && (
        <div className="mb-4">
          <label className="mb-1 block text-sm font-medium text-slate-700">
            หมายเหตุ {pendingAction === "reject" && <span className="text-red-500">*</span>}
          </label>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            placeholder="เหตุผล/ความเห็น..."
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
          />
          <div className="mt-2 flex gap-2">
            <button
              onClick={confirmAction}
              disabled={isLoading || (pendingAction === "reject" && !note)}
              className="rounded-lg bg-blue-600 px-4 py-1.5 text-sm font-medium text-white disabled:opacity-60"
            >
              {isLoading ? "กำลังดำเนินการ..." : "ยืนยัน"}
            </button>
            <button onClick={cancelNote} className="text-sm text-slate-400 hover:text-slate-600">
              ยกเลิก
            </button>
          </div>
        </div>
      )}

      {!showNoteInput && (
        <div className="flex flex-wrap gap-3">
          {canSubmit && (
            <button
              onClick={handleSubmit}
              disabled={isLoading}
              className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-blue-700 disabled:opacity-60"
            >
              <Send size={15} />
              ส่งขออนุมัติ
            </button>
          )}

          {canApprove && (
            <>
              <button
                onClick={() => askAction("approve")}
                disabled={isLoading}
                className="flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-green-700 disabled:opacity-60"
              >
                <CheckCircle size={15} />
                อนุมัติ PO
              </button>
              <button
                onClick={() => askAction("reject")}
                disabled={isLoading}
                className="flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-red-700 disabled:opacity-60"
              >
                <XCircle size={15} />
                ไม่อนุมัติ
              </button>
            </>
          )}

          {canCancel && (
            <button
              onClick={handleCancel}
              disabled={isLoading}
              className="flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-600 transition hover:bg-slate-50 disabled:opacity-60"
            >
              <X size={15} />
              ยกเลิก PO
            </button>
          )}
        </div>
      )}
    </div>
  );
}
