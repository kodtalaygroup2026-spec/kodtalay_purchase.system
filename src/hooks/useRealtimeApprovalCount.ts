"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { countApprovablePRs, canApproveAnything, type ApproverScope } from "@/lib/pr/approvals";

/**
 * นับใบที่รออนุมัติ (ที่ผู้ใช้คนนี้อนุมัติได้จริง) แบบเรียลไทม์
 * ป้ายแดง "การอนุมัติ / รออนุมัติ" ขยับทันทีเมื่อมีใบส่งเข้ามาหรือถูกอนุมัติ/ตีกลับ
 *
 * @param initialCount ค่าเริ่มต้นที่ server คำนวณมา (กันจอกระพริบ)
 * @param scope        role / แผนก / ตำแหน่งที่เป็นสมาชิก — ใช้กรองสิทธิ์ให้ตรงกับหน้า /approvals
 * @param channelName  ชื่อ channel ต้องไม่ซ้ำในแต่ละจุดที่เรียกใช้
 */
export function useRealtimeApprovalCount(
  initialCount: number,
  scope: ApproverScope,
  channelName: string,
): number {
  const [count, setCount] = useState(initialCount);

  useEffect(() => {
    setCount(initialCount);
  }, [initialCount]);

  // แปลง scope เป็นค่าคงที่สำหรับ dependency (กัน effect รีรันจาก object identity)
  const scopeKey = `${scope.role}|${scope.department}|${scope.positionIds.join(",")}`;

  useEffect(() => {
    if (!canApproveAnything(scope)) return;
    const supabase = createClient();

    async function refetch() {
      setCount(await countApprovablePRs(supabase, scope));
    }

    const channel = supabase
      .channel(channelName)
      .on(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        "postgres_changes" as any,
        { event: "*", schema: "public", table: "purchase_requisitions" },
        () => {
          refetch();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channelName, scopeKey]);

  return count;
}
