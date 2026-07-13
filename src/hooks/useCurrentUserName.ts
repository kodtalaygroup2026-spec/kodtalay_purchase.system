"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

/**
 * ดึงชื่อ (full_name) ของผู้ใช้ปัจจุบันจาก id — โหลดครั้งเดียวตอน mount
 * ใช้สำหรับใส่ "ผู้ดำเนินการ" ในข้อความแจ้งเตือน LINE
 */
export function useCurrentUserName(userId: string): string {
  const [name, setName] = useState("");

  useEffect(() => {
    if (!userId) return;
    let active = true;
    const supabase = createClient();
    supabase
      .from("profiles")
      .select("full_name")
      .eq("id", userId)
      .single()
      .then(({ data }: { data: { full_name: string | null } | null }) => {
        if (active && data?.full_name) setName(data.full_name);
      });
    return () => {
      active = false;
    };
  }, [userId]);

  return name;
}
