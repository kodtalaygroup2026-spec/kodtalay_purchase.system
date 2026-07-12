"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { PrStatus, UserRole } from "@/types/database";
import { CheckCircle, XCircle, Send, X, RotateCcw } from "lucide-react";
import { formatCurrency } from "@/lib/utils/format";
import { logAudit } from "@/lib/supabase/audit";
import { externalBrowserLink } from "@/lib/line/externalLink";

interface PRApprovalPanelProps {
  pr: {
    id: string;
    pr_number: string;
    title: string;
    total_amount: number;
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
  // ผู้อนุมัติ = หัวหน้า (manager) / admin / ฝ่ายบัญชี (finance = บช.)
  const isApprover =
    currentUserRole === "manager" ||
    currentUserRole === "admin" ||
    currentUserRole === "finance";

  const canSubmit = isOwner && pr.status === "draft";
  const canApprove = isApprover && pr.status === "submitted";
  const canSecondApprove = isApprover && pr.status === "pending_second_approval";
  // ยกเลิกได้เฉพาะก่อน submit (draft) เท่านั้น — หลัง submit ถือว่าเข้าสู่กระบวนการแล้ว
  const canCancel = isOwner && pr.status === "draft";

  // ── LINE notification helpers ────────────────────────────────────────────
  function prUrl(): string {
    return externalBrowserLink(`${window.location.origin}/requisitions/${pr.id}`);
  }

  async function notifyLine(lineUserId: string, message: string) {
    try {
      await fetch("/api/notifications/line", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lineUserId, message }),
      });
    } catch {
      // ไม่ block flow หลัก ถ้า notification ส่งไม่สำเร็จ
    }
  }

  // เดิมยิงหา admin/manager ทุกคนทั้งบริษัท
  // เปลี่ยนเป็นให้เซิร์ฟเวอร์หาผู้อนุมัติของใบนี้เอง (หัวหน้าแผนก + ตำแหน่งของหมวด + บช.)
  async function notifyApproversOnSubmit() {
    try {
      await fetch("/api/notifications/pr-event", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prId: pr.id,
          event: "submitted",
          actorId: currentUserId,
          origin: window.location.origin,
        }),
      });
    } catch {
      // ไม่ block flow หลัก ถ้า notification ส่งไม่สำเร็จ
    }
  }

  async function notifyRequester(action: "approve" | "reject" | "return") {
    const { data: requester } = await supabase
      .from("profiles")
      .select("line_user_id")
      .eq("id", pr.requester_id)
      .single();

    if (!requester?.line_user_id) return;

    const noteText = note ? `\nเหตุผล : ${note}` : "";
    let message = "";

    if (action === "approve") {
      message =
        `✅ แจ้งผลการพิจารณา : ใบขอซื้อได้รับการอนุมัติ\n\n` +
        `เลขที่เอกสาร : ${pr.pr_number}\n` +
        `รายการ : ${pr.title}\n` +
        `จำนวนเงิน : ${formatCurrency(pr.total_amount)}\n\n` +
        `ท่านสามารถดำเนินการในขั้นตอนถัดไปได้\n` +
        `รายละเอียด : ${prUrl()}`;
    } else if (action === "reject") {
      message =
        `❌ แจ้งผลการพิจารณา : ใบขอซื้อไม่ได้รับการอนุมัติ\n\n` +
        `เลขที่เอกสาร : ${pr.pr_number}\n` +
        `รายการ : ${pr.title}${noteText}\n\n` +
        `รายละเอียด : ${prUrl()}`;
    } else {
      message =
        `🔄 แจ้งเตือน : ใบขอซื้อถูกส่งกลับเพื่อแก้ไข\n\n` +
        `เลขที่เอกสาร : ${pr.pr_number}\n` +
        `รายการ : ${pr.title}${noteText}\n\n` +
        `กรุณาแก้ไขข้อมูลและส่งขออนุมัติอีกครั้ง\n` +
        `รายละเอียด : ${prUrl()}`;
    }

    void notifyLine(requester.line_user_id, message);
  }

  // ── Status update ────────────────────────────────────────────────────────
  async function updateStatus(
    status: string,
    audit: Record<string, string | null> = {}
  ) {
    const { error } = await (supabase as any)
      .from("purchase_requisitions")
      .update({ status, ...audit })
      .eq("id", pr.id);
    if (!error) router.refresh();
  }

  async function handleSubmit() {
    setIsLoading(true);
    const now = new Date().toISOString();
    await updateStatus("submitted", {
      submitted_at: now,
      submitted_by: currentUserId,
    });
    logAudit({
      actorId: currentUserId,
      action: "pr_submitted",
      entity: "purchase_requisitions",
      entityId: pr.id,
      metadata: { pr_number: pr.pr_number, title: pr.title },
    });
    void notifyApproversOnSubmit();
    setIsLoading(false);
  }

  async function handleCancel() {
    setIsLoading(true);
    const now = new Date().toISOString();
    await updateStatus("cancelled", {
      cancelled_at: now,
      cancelled_by: currentUserId,
    });
    logAudit({
      actorId: currentUserId,
      action: "pr_cancelled",
      entity: "purchase_requisitions",
      entityId: pr.id,
      metadata: { pr_number: pr.pr_number },
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
    if ((pendingAction === "reject" || pendingAction === "return") && !note) return;
    setIsLoading(true);

    const now = new Date().toISOString();
    const statusMap: Record<string, string> = {
      approve: "approved",
      reject: "rejected",
      return: "returned",
      cancel_pr: "cancelled",
    };
    const auditMap: Record<string, Record<string, string | null>> = {
      approve:   { approved_at: now, approved_by: currentUserId, rejection_reason: null },
      reject:    { rejected_at: now, rejected_by: currentUserId, rejection_reason: note || null },
      return:    { rejected_at: now, rejected_by: currentUserId, rejection_reason: note || null },
      cancel_pr: { cancelled_at: now, cancelled_by: currentUserId },
    };

    await updateStatus(statusMap[pendingAction], auditMap[pendingAction] ?? {});

    const actionMap: Record<string, "pr_approved" | "pr_rejected" | "pr_returned" | "pr_cancelled"> = {
      approve: "pr_approved",
      reject: "pr_rejected",
      return: "pr_returned",
      cancel_pr: "pr_cancelled",
    };
    logAudit({
      actorId: currentUserId,
      action: actionMap[pendingAction],
      entity: "purchase_requisitions",
      entityId: pr.id,
      metadata: { pr_number: pr.pr_number, note: note || null },
    });

    // แจ้ง LINE requester เมื่ออนุมัติ / ปฏิเสธ / ตีกลับ
    if (pendingAction === "approve" || pendingAction === "reject" || pendingAction === "return") {
      void notifyRequester(pendingAction);
    }

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
              {/* ตีกลับ: ใช้ได้ทั้งรอบ 1 (submitted) และรอบ 2 (pending_second_approval) */}
              <button
                onClick={() => askAction("return")}
                disabled={isLoading}
                className="flex items-center gap-2 rounded-lg bg-orange-500 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-orange-600 disabled:opacity-60"
              >
                <RotateCcw size={15} />
                ตีกลับ
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
              ยกเลิก PR
            </button>
          )}
        </div>
      )}
    </div>
  );
}
