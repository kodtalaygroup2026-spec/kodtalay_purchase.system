-- ===========================================================================
-- LINE Account Link — เก็บ nonce ชั่วคราวระหว่างเชื่อมบัญชี
-- flow: บอทออก linkToken → เว็บสร้าง nonce ผูกกับ user → LINE ส่ง accountLink
--       event กลับมาพร้อม nonce → webhook จับคู่ nonce เป็น user แล้วบันทึก
--       line_user_id
-- แตะเฉพาะ service role (webhook + route /line/link) จึงไม่ต้องมี RLS policy
-- ===========================================================================

CREATE TABLE IF NOT EXISTS public.line_link_nonces (
  nonce       text PRIMARY KEY,
  user_id     uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT now(),
  expires_at  timestamptz NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_line_link_nonces_expires
  ON public.line_link_nonces(expires_at);

ALTER TABLE public.line_link_nonces ENABLE ROW LEVEL SECURITY;
