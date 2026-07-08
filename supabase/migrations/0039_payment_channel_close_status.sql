-- Migration 0039: ช่องทางจ่าย (บริษัท/เงินสดย่อย) + สถานะเอกสารตอนปิด (สมบูรณ์/ไม่สมบูรณ์)

ALTER TABLE public.payment_evidences
  ADD COLUMN IF NOT EXISTS payment_channel text
    CHECK (payment_channel IN ('company', 'petty_cash')),
  ADD COLUMN IF NOT EXISTS close_status text
    CHECK (close_status IN ('complete', 'incomplete'));

COMMENT ON COLUMN public.payment_evidences.payment_channel
  IS 'ช่องทางจ่าย: company=บริษัทสั่งจ่าย, petty_cash=เงินสดย่อย (บช.เลือกตอนตรวจสอบ)';
COMMENT ON COLUMN public.payment_evidences.close_status
  IS 'สถานะเอกสารตอนจ่าย: complete=สมบูรณ์, incomplete=ค้างเอกสาร';
