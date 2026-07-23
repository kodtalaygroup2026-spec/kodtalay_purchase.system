"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export interface FinanceCounts {
  /** รอตรวจสอบ — หลักฐาน submitted (ป้าย "งานตรวจสอบ") */
  verify: number;
  /** รอจ่าย ช่องทางบริษัทสั่งจ่าย — verified + channel company/null (ป้าย "รายการบริษัทสั่งจ่าย") */
  company: number;
  /** รอจ่าย ช่องทางเงินสดย่อย — verified + channel petty_cash (ป้าย "รายการเงินสดย่อย") */
  pettyCash: number;
}

/**
 * นับงานฝ่ายบัญชีทั้ง 3 ป้ายแบบเรียลไทม์จากตาราง payment_evidences
 * (นับเฉพาะใบที่ PR ยังเป็น pending_finance — ตรงกับที่แต่ละหน้ากรอง)
 *
 * subscribe ตารางเดียว → เปลี่ยนแปลงทีไรคำนวณใหม่ทั้ง 3 ค่า ป้ายจึงขยับทันที
 * ทั้งตอนส่งตรวจ / ตรวจเสร็จส่งเข้าช่องทางจ่าย / จ่ายเสร็จ
 *
 * @param enabled     เปิด subscribe เฉพาะ finance/admin
 * @param channelName ชื่อ channel ต้องไม่ซ้ำในแต่ละจุดที่เรียกใช้ (sidebar / mobilenav)
 */
export function useRealtimeFinanceCounts(
  initialVerify: number,
  initialCompany: number,
  initialPettyCash: number,
  enabled: boolean,
  channelName: string,
): FinanceCounts {
  const [counts, setCounts] = useState<FinanceCounts>({
    verify: initialVerify,
    company: initialCompany,
    pettyCash: initialPettyCash,
  });

  // sync ค่าเริ่มต้นใหม่เมื่อ server re-render มาพร้อมค่าที่ต่างไป (เช่น หลัง navigation)
  useEffect(() => {
    setCounts({ verify: initialVerify, company: initialCompany, pettyCash: initialPettyCash });
  }, [initialVerify, initialCompany, initialPettyCash]);

  useEffect(() => {
    if (!enabled) return;
    const supabase = createClient();

    const distinctPrCount = (res: { data: unknown }) =>
      new Set(((res.data ?? []) as { pr_id: string }[]).map((row) => row.pr_id)).size;

    async function refetchCounts() {
      const [verifyRes, companyRes, pettyRes] = await Promise.all([
        (supabase as any)
          .from("payment_evidences")
          .select("pr_id, purchase_requisitions!inner(status)")
          .eq("status", "submitted")
          .eq("purchase_requisitions.status", "pending_finance")
          .limit(500),
        (supabase as any)
          .from("payment_evidences")
          .select("pr_id, purchase_requisitions!inner(status)")
          .eq("status", "verified")
          .or("payment_channel.eq.company,payment_channel.is.null")
          .eq("purchase_requisitions.status", "pending_finance")
          .limit(500),
        (supabase as any)
          .from("payment_evidences")
          .select("pr_id, purchase_requisitions!inner(status)")
          .eq("status", "verified")
          .eq("payment_channel", "petty_cash")
          .eq("purchase_requisitions.status", "pending_finance")
          .limit(500),
      ]);
      setCounts({
        verify: distinctPrCount(verifyRes),
        company: distinctPrCount(companyRes),
        pettyCash: distinctPrCount(pettyRes),
      });
    }

    const channel = supabase
      .channel(channelName)
      .on(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        "postgres_changes" as any,
        { event: "*", schema: "public", table: "payment_evidences" },
        () => {
          refetchCounts();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [enabled, channelName]);

  return counts;
}
