// ===========================================================================
// File: src/lib/env.ts
// คำอธิบาย: ตรวจสอบและรวมศูนย์ environment variables ด้วย zod
// ===========================================================================
import { z } from "zod";

const schema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url().default("https://placeholder.supabase.co"),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1).default("placeholder"),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
});

const parsed = schema.safeParse({
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
});

// ตอน build phase ไม่ throw — throw เฉพาะตอน runtime จริง
if (!parsed.success) {
  const isBuildPhase = process.env.NEXT_PHASE === "phase-production-build";
  if (!isBuildPhase) {
    const issues = parsed.error.issues.map((i) => `- ${i.path.join(".")}: ${i.message}`).join("\n");
    throw new Error(`ตั้งค่า environment variables ไม่ถูกต้อง:\n${issues}`);
  }
}

export const env = parsed.data ?? {
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
};
