"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { countIncompleteDocs } from "@/lib/pr/incompleteDocs";

/**
 * ป้าย "งานเอกสารไม่สมบูรณ์" ของคนเบิก — อัปเดตเรียลไทม์
 * เด้งทันทีเมื่อ บช. จ่ายแล้วแจ้งเอกสารไม่ครบ / ตีกลับอีกรอบ / ยืนยันสมบูรณ์
 *
 * @param initialCount ค่าเริ่มต้นที่ server คำนวณมา (กันจอกระพริบ)
 * @param userId       เจ้าของใบ — นับเฉพาะงานของตัวเองเท่านั้น
 * @param channelName  ชื่อ channel ต้องไม่ซ้ำในแต่ละจุดที่เรียกใช้
 */
export function useRealtimeIncompleteCount(
  initialCount: number,
  userId: string,
  channelName: string,
): number {
  const [count, setCount] = useState(initialCount);

  useEffect(() => {
    setCount(initialCount);
  }, [initialCount]);

  useEffect(() => {
    if (!userId) return;
    const supabase = createClient();

    async function refetch() {
      const { count: next } = await countIncompleteDocs(supabase, userId);
      setCount(next);
    }

    const channel = supabase
      .channel(channelName)
      .on(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        "postgres_changes" as any,
        { event: "*", schema: "public", table: "payment_evidences" },
        () => {
          refetch();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, channelName]);

  return count;
}
