"use client";

import { createClient } from "@/lib/supabase/client";

export type AuditAction =
  // PR
  | "pr_created"
  | "pr_submitted"
  | "pr_approved"
  | "pr_rejected"
  | "pr_returned"
  | "pr_cancelled"
  // PO
  | "po_created"
  | "po_submitted"
  | "po_approved"
  | "po_cancelled"
  // การเงิน
  | "payment_evidence_submitted"
  | "ktb_batch_paid"
  | "payment_marked_paid"
  | "payment_returned"
  | "payment_cancelled"
  | "payment_verified"
  | "documents_completed"
  // ผู้ใช้
  | "user_role_changed";

/**
 * บันทึก audit log — fire-and-forget ไม่ block flow หลัก
 */
export function logAudit(params: {
  actorId: string;
  action: AuditAction;
  entity: string;
  entityId?: string | null;
  metadata?: Record<string, unknown> | null;
}): void {
  const supabase = createClient();
  void (supabase as any)
    .from("audit_logs")
    .insert({
      actor_id: params.actorId,
      action: params.action,
      entity: params.entity,
      entity_id: params.entityId ?? null,
      metadata: params.metadata ?? null,
    })
    .then(({ error }: { error: unknown }) => {
      if (error && process.env.NODE_ENV === "development") {
        console.warn("[audit]", params.action, error);
      }
    });
}
