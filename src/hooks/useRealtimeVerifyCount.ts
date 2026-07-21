"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

/**
 * นับจำนวนใบที่ "รอตรวจสอบหลักฐาน" แบบเรียลไทม์
 * (distinct pr_id ของ payment_evidences ที่ status = 'submitted' — ตรงกับที่ layout คำนวณ)
 *
 * ป้ายแดงข้างเมนู "งานตรวจสอบ" จะขยับทันทีเมื่อมีการส่งหลักฐานเข้ามา
 * หรือการเงินตรวจเสร็จ โดยไม่ต้องรีเฟรชหน้า
 *
 * @param initialCount ค่าเริ่มต้นที่ server render มาให้ (กันจอกระพริบตอนโหลดแรก)
 * @param enabled       เปิด subscribe เฉพาะ finance/admin — role อื่นไม่ต้องเชื่อม
 * @param channelName   ชื่อ channel ต้องไม่ซ้ำกันในแต่ละจุดที่เรียกใช้ (sidebar / mobilenav)
 */
export function useRealtimeVerifyCount(
  initialCount: number,
  enabled: boolean,
  channelName: string,
): number {
  const [count, setCount] = useState(initialCount);

  // sync ค่าเริ่มต้นใหม่เมื่อ server re-render มาพร้อมค่าที่ต่างไป (เช่น หลัง navigation)
  useEffect(() => {
    setCount(initialCount);
  }, [initialCount]);

  useEffect(() => {
    if (!enabled) return;
    const supabase = createClient();

    async function refetchCount() {
      const { data } = await (supabase as any)
        .from("payment_evidences")
        .select("pr_id")
        .eq("status", "submitted")
        .limit(500);
      const distinctPrCount = new Set(
        ((data ?? []) as { pr_id: string }[]).map((row) => row.pr_id)
      ).size;
      setCount(distinctPrCount);
    }

    const channel = supabase
      .channel(channelName)
      .on(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        "postgres_changes" as any,
        { event: "*", schema: "public", table: "payment_evidences" },
        () => {
          refetchCount();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [enabled, channelName]);

  return count;
}
