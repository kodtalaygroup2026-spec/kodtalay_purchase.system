"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { PrStatus, UserRole } from "@/types/database";
import { CheckCircle, XCircle, Send, X } from "lucide-react";

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
  const [pendingAction, setPendingAction] = useState<"approve" | "reject" | null>(null);

  const isOwner = currentUserId === pr.requester_id;
  const isApprover =
    currentUserRole === "manager" || currentUserRole === "admin";
  const canSubmit = isOwner && pr.status === "draft";
  const canApprove = isApprover && pr.status === "submitted";
  const canCancel = isOwner && (pr.status === "draft" || pr.status === "submitted");

  async function handleSubmit() {
    setIsLoading(true);
    const { error } = await supabase
      .from("purchase_requisitions")
      .update({ status: "submitted" })
      .eq("id", pr.id);

    if (!error) {
      // แจ้ง LINE notification
      await fetch("/api/notifications/line", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prId: pr.id, event: "submitted" }),
      });
      router.refresh();
    }
    setIsLoading(false);
  }

  async function handleApprove() {
    if (!showNoteInput) {
      setShowNoteInput(true);
      setPendingAction("approve");
      return;
    }
    setIsLoading(true);
    const { error } = await supabase
      .from("purchase_requisitions")
      .update({ status: "approved" })
      .eq("id", pr.id);

    if (!error) {
      await fetch("/api/notifications/line", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prId: pr.id, event: "approved" }),
      });
      router.refresh();
    }
    setIsLoading(false);
    setShowNoteInput(false);
  }

  async function handleReject() {
    if (!showNoteInput) {
      setShowNoteInput(true);
      setPendingAction("reject");
      return;
    }
    setIsLoading(true);
    const { error } = await supabase
      .from("purchase_requisitions")
      .update({ status: "rejected" })
      .eq("id", pr.id);

    if (!error) {
      await fetch("/api/notifications/line", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prId: pr.id, event: "rejected", note }),
      });
      router.refresh();
    }
    setIsLoading(false);
    setShowNoteInput(false);
  }

  async function handleCancel() {
    setIsLoading(true);
    await supabase
      .from("purchase_requisitions")
      .update({ status: "cancelled" })
      .eq("id", pr.id);
    router.refresh();
    setIsLoading(false);
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
          <button
            onClick={() => {
              setShowNoteInput(false);
              setPendingAction(null);
              setNote("");
            }}
            className="mt-1 text-xs text-slate-400 hover:text-slate-600"
          >
            ยกเลิก
          </button>
        </div>
      )}

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
              onClick={handleApprove}
              disabled={isLoading}
              className="flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-green-700 disabled:opacity-60"
            >
              <CheckCircle size={15} />
              {showNoteInput && pendingAction === "approve" ? "ยืนยันอนุมัติ" : "อนุมัติ"}
            </button>
            <button
              onClick={handleReject}
              disabled={isLoading || (showNoteInput && pendingAction === "reject" && !note)}
              className="flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-red-700 disabled:opacity-60"
            >
              <XCircle size={15} />
              {showNoteInput && pendingAction === "reject" ? "ยืนยันไม่อนุมัติ" : "ไม่อนุมัติ"}
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
    </div>
  );
}
