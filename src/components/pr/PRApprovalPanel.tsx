"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { PrStatus, UserRole } from "@/types/database";
import { CheckCircle, XCircle, Send, X, RotateCcw } from "lucide-react";

interface PRApprovalPanelProps {
  pr: {
    id: string;
    status: PrStatus;
    requester_id: string;
  };
  currentUserId: string;
  currentUserRole: UserRole | undefined;
}

export function PRApprovalPanel({
  pr,
  currentUserId,
  currentUserRole,
}: PRApprovalPanelProps) {
  const router = useRouter();
  const supabase = createClient();
  const [isLoading, setIsLoading] = useState(false);
  const [note, setNote] = useState("");
  const [showNoteInput, setShowNoteInput] = useState(false);
  const [pendingAction, setPendingAction] = useState<"approve" | "reject" | "return" | "cancel_pr" | null>(null);

  const isOwner = currentUserId === pr.requester_id;
  const isApprover = currentUserRole === "manager" || currentUserRole === "admin";

  const canSubmit = isOwner && pr.status === "draft";
  const canApprove = isApprover && pr.status === "submitted";
  const canSecondApprove = isApprover && pr.status === "pending_second_approval";
  const canCancel = isOwner && (pr.status === "draft" || pr.status === "submitted" || pr.status === "returned");

  async function updateStatus(status: string) {
    const { error } = await supabase
      .from("purchase_requisitions")
      .update({ status })
      .eq("id", pr.id);
    if (!error) router.refresh();
  }

  async function handleSubmit() {
    setIsLoading(true);
    await updateStatus("submitted");
    setIsLoading(false);
  }

  async function handleCancel() {
    setIsLoading(true);
    await updateStatus("cancelled");
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
    if ((pendingAction === "reject" || pendingAction === "return") && !note) return;
    setIsLoading(true);

    const statusMap: Record<string, string> = {
      approve: "approved",
      reject: "rejected",
      return: "returned",
      cancel_pr: "cancelled",
    };
    await updateStatus(statusMap[pendingAction]);

    setIsLoading(false);
    cancelNote();
  }

  if (!canSubmit && !canApprove && !canSecondApprove && !canCancel) return null;

  const needNote = pendingAction === "reject" || pendingAction === "return";

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <h3 className="mb-4 font-semibold text-slate-700">การดำเนินการ</h3>

      {showNoteInput && (
        <div className="mb-4">
          <label className="mb-1 block text-sm font-medium text-slate-700">
            หมายเหตุ {needNote && <span className="text-red-500">*</span>}
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
              disabled={isLoading || (needNote && !note)}
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

          {(canApprove || canSecondApprove) && (
            <>
              <button
                onClick={() => askAction("approve")}
                disabled={isLoading}
                className="flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-green-700 disabled:opacity-60"
              >
                <CheckCircle size={15} />
                {canSecondApprove ? "อนุมัติ (รอบ 2)" : "อนุมัติ"}
              </button>
              {canSecondApprove && (
                <button
                  onClick={() => askAction("return")}
                  disabled={isLoading}
                  className="flex items-center gap-2 rounded-lg bg-orange-500 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-orange-600 disabled:opacity-60"
                >
                  <RotateCcw size={15} />
                  ตีกลับ
                </button>
              )}
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
              ยกเลิก PR
            </button>
          )}
        </div>
      )}
    </div>
  );
}
