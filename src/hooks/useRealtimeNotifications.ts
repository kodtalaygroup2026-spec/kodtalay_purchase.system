"use client";

import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import type { UserRole } from "@/types/database";

export interface PRNotification {
  prId: string;
  prNumber: string;
  title: string;
  newStatus: string;
}

interface Options {
  userId: string;
  role: UserRole;
  onNotification: (item: PRNotification) => void;
}

// สถานะที่แต่ละ role ควรได้รับแจ้งเตือน
const WATCHED_STATUSES: Record<string, string[]> = {
  manager: ["submitted", "pending_second_approval"],
  admin:   ["submitted", "pending_second_approval", "pending_finance"],
  finance: ["pending_finance"],
  employee: ["approved", "rejected", "returned"],
};

export function useRealtimeNotifications({ userId, role, onNotification }: Options) {
  useEffect(() => {
    const supabase = createClient();
    const watchedStatuses = WATCHED_STATUSES[role] ?? [];

    const channel = supabase
      .channel("pr-status-notifications")
      .on(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        "postgres_changes" as any,
        { event: "UPDATE", schema: "public", table: "purchase_requisitions" },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (payload: any) => {
          const prev = payload.old as { status?: string };
          const next = payload.new as {
            id: string;
            pr_number: string;
            title: string;
            status: string;
            requester_id: string;
          };

          // ไม่ทำอะไรถ้า status ไม่เปลี่ยน
          if (!next.status || next.status === prev.status) return;

          // employee: แจ้งเฉพาะ PR ของตัวเอง
          if (role === "employee") {
            if (next.requester_id !== userId) return;
          }

          if (!watchedStatuses.includes(next.status)) return;

          onNotification({
            prId:      next.id,
            prNumber:  next.pr_number,
            title:     next.title,
            newStatus: next.status,
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, role, onNotification]);
}
