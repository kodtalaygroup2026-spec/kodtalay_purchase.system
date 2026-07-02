-- ============================================================
-- 0029: เพิ่มข้อมูลบัญชีธนาคารในตาราง profiles
--       และเพิ่ม payment_type ในตาราง payment_evidences
-- ไม่ต้องแยก table — 1 user = 1 บัญชีหลัก
-- ============================================================

-- เพิ่มข้อมูลบัญชีธนาคารให้ profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS bank_name        text,
  ADD COLUMN IF NOT EXISTS bank_account_number text;

-- เพิ่ม payment_type เพื่อแยกว่าจ่ายเองหรือส่งบิลให้ บช. จ่าย
ALTER TABLE public.payment_evidences
  ADD COLUMN IF NOT EXISTS payment_type text
    CHECK (payment_type IN ('self_pay', 'send_bill'))
    DEFAULT 'send_bill';
