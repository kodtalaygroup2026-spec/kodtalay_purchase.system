-- Migration 0004: LINE User ID linking
-- รันใน Supabase Dashboard > SQL Editor

-- เพิ่ม line_user_id ใน profiles
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS line_user_id text;

-- ตารางเก็บรหัส OTP สำหรับเชื่อม LINE (ลบอัตโนมัติหลัง 10 นาที)
CREATE TABLE IF NOT EXISTS line_link_codes (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  code        text        NOT NULL UNIQUE,
  user_id     uuid        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  expires_at  timestamptz NOT NULL DEFAULT (now() + interval '10 minutes'),
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_line_link_codes_expires ON line_link_codes(expires_at);

-- RLS: ให้ service role เข้าถึงได้เท่านั้น (webhook ใช้ admin client)
ALTER TABLE line_link_codes ENABLE ROW LEVEL SECURITY;
