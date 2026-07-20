-- Migration 0041: เอกสารที่พนักงานแก้แล้ว รอ บช. ตรวจยืนยัน
--   close_status เพิ่มค่า 'fixed' = พนักงานแก้/แนบเอกสารเพิ่มแล้ว ส่งให้การเงินตรวจ
--   การเงินกดตัดสินในหน้า "งานเอกสารสมบูรณ์": สมบูรณ์ (complete) หรือตีกลับอีก (incomplete)

ALTER TABLE public.payment_evidences
  DROP CONSTRAINT IF EXISTS payment_evidences_close_status_check;

ALTER TABLE public.payment_evidences
  ADD CONSTRAINT payment_evidences_close_status_check
  CHECK (close_status IN ('complete', 'incomplete', 'fixed'));

-- บันทึกของฝั่งพนักงานตอนส่งแก้: อธิบายสิ่งที่แก้/เพิ่ม + เวลา
ALTER TABLE public.payment_evidences
  ADD COLUMN IF NOT EXISTS fix_note text,
  ADD COLUMN IF NOT EXISTS fixed_at timestamptz;
