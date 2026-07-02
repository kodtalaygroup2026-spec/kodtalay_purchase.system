-- Migration 0033: เพิ่มสถานะ 'verified' (ผ่านการตรวจสอบจากฝ่ายบัญชี) ใน payment_evidences
-- flow ใหม่: submitted (รอตรวจ) → verified (ตรวจแล้ว รอจ่าย) → paid

ALTER TABLE public.payment_evidences
  DROP CONSTRAINT IF EXISTS payment_evidences_status_check;

ALTER TABLE public.payment_evidences
  ADD CONSTRAINT payment_evidences_status_check
  CHECK (status IN ('submitted', 'verified', 'returned', 'paid', 'cancelled'));

COMMENT ON COLUMN public.payment_evidences.status
  IS 'submitted=รอบัญชีตรวจ, verified=ตรวจแล้วรอจ่าย, returned=ตีกลับให้แก้, paid=จ่ายแล้ว, cancelled=ยกเลิก';
