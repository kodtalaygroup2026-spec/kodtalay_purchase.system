// ===========================================================================
// File: src/lib/env.ts
// คำอธิบาย: ตรวจสอบและรวมศูนย์ environment variables ด้วย zod
//          ช่วยให้ระบบ fail-fast ถ้าตั้งค่าไม่ครบ (เสถียรขึ้น) และได้ type ที่ถูกต้อง
// ===========================================================================
import { z } from "zod";

// schema สำหรับ env ฝั่ง client (ต้องขึ้นต้นด้วย NEXT_PUBLIC_)
const clientSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url("NEXT_PUBLIC_SUPABASE_URL ต้องเป็น URL ที่ถูกต้อง"),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1, "ต้องระบุ NEXT_PUBLIC_SUPABASE_ANON_KEY"),
});

// service role key เป็น optional ฝั่ง client (จะมีค่าเฉพาะตอนรันฝั่ง server)
const serverSchema = z.object({
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
});

const parsed = clientSchema.merge(serverSchema).safeParse({
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
});

if (!parsed.success) {
  // รวมข้อความ error ให้อ่านง่าย แล้วหยุดการทำงานทันที
  const issues = parsed.error.issues.map((i) => `- ${i.path.join(".")}: ${i.message}`).join("\n");
  throw new Error(`ตั้งค่า environment variables ไม่ถูกต้อง:\n${issues}`);
}

export const env = parsed.data;
