"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { X, Bell } from "lucide-react";
import { useRealtimeNotifications, type PRNotification } from "@/hooks/useRealtimeNotifications";
import { getNextPaymentDate, formatPaymentDate } from "@/lib/utils/paymentSchedule";
import type { UserRole } from "@/types/database";

// ข้อความแจ้งเตือนภาษาไทยตาม status
const STATUS_LABEL: Record<string, { title: string; color: string }> = {
  submitted:                 { title: "มี PR ใหม่รอการอนุมัติ",      color: "bg-blue-600"   },
  pending_second_approval:   { title: "มี PR รออนุมัติขั้นที่ 2",     color: "bg-indigo-600" },
  pending_finance:           { title: "มี PR พร้อมดำเนินการจ่ายเงิน", color: "bg-violet-600" },
  approved:                  { title: "PR ของคุณได้รับการอนุมัติ",    color: "bg-green-600"  },
  rejected:                  { title: "PR ของคุณถูกปฏิเสธ",           color: "bg-red-600"    },
  returned:                  { title: "PR ถูกส่งคืนเพื่อแก้ไข",       color: "bg-amber-600"  },
};

interface Toast {
  id: string;
  notification: PRNotification;
  paymentDateLabel?: string; // แสดงเฉพาะ status=approved
}

interface Props {
  userId: string;
  role: UserRole;
}

// วางเป็น standalone component — ไม่ wraps children เลย
// layout.tsx แค่ render <RealtimeNotificationProvider ... /> ข้างๆ เนื้อหาปกติ
export function RealtimeNotificationProvider({ userId, role }: Props) {
  const router = useRouter();
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const handleNotification = useCallback(
    (item: PRNotification) => {
      const id = `${Date.now()}-${item.prId}`;
      const paymentDateLabel =
        item.newStatus === "approved"
          ? formatPaymentDate(getNextPaymentDate())
          : undefined;
      setToasts((prev) => {
        // สูงสุด 3 toasts พร้อมกัน
        const next = [...prev, { id, notification: item, paymentDateLabel }];
        return next.slice(-3);
      });

      // auto-dismiss หลัง 7 วินาที
      setTimeout(() => dismiss(id), 7000);

      // refresh server data → badge count ใน sidebar อัปเดตเอง
      router.refresh();
    },
    [dismiss, router]
  );

  useRealtimeNotifications({ userId, role, onNotification: handleNotification });

  if (toasts.length === 0) return null;

  return (
    <div
      aria-live="polite"
      className="fixed bottom-6 right-4 z-50 flex flex-col gap-2 sm:right-6"
    >
      {toasts.map(({ id, notification, paymentDateLabel }) => {
        const config = STATUS_LABEL[notification.newStatus] ?? {
          title: "มีการอัปเดต PR",
          color: "bg-slate-700",
        };

        return (
          <div
            key={id}
            className="flex w-80 items-start gap-3 rounded-xl bg-white shadow-xl ring-1 ring-slate-200 animate-in slide-in-from-right-4 fade-in duration-300"
          >
            {/* color strip */}
            <div className={`w-1.5 self-stretch flex-shrink-0 rounded-l-xl ${config.color}`} />

            {/* icon */}
            <div className="mt-3 flex-shrink-0">
              <Bell size={16} className="text-slate-500" />
            </div>

            {/* content */}
            <div className="flex-1 py-3 pr-1">
              <p className="text-sm font-semibold text-slate-800">{config.title}</p>
              <p className="mt-0.5 text-xs text-slate-500 line-clamp-1">
                {notification.prNumber} · {notification.title}
              </p>
              {paymentDateLabel && (
                <p className="mt-0.5 text-[11px] font-medium text-violet-600">
                  คาดจ่ายเงิน: {paymentDateLabel}
                </p>
              )}
              <Link
                href={`/requisitions/${notification.prId}`}
                onClick={() => dismiss(id)}
                className="mt-1.5 inline-block text-xs font-medium text-blue-600 hover:underline"
              >
                ดู PR →
              </Link>
            </div>

            {/* dismiss button */}
            <button
              onClick={() => dismiss(id)}
              className="mr-2 mt-2 flex-shrink-0 rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              aria-label="ปิด"
            >
              <X size={14} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
