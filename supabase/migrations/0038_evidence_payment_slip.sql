-- Migration 0038: เพิ่มชนิดไฟล์ 'payment_slip' (สลิปโอนจากฝ่ายบัญชีตอนกดจ่าย)

ALTER TABLE public.evidence_files
  DROP CONSTRAINT IF EXISTS evidence_files_evidence_type_check;

ALTER TABLE public.evidence_files
  ADD CONSTRAINT evidence_files_evidence_type_check
  CHECK (evidence_type IN ('bill', 'slip', 'goods_receipt', 'payment_slip', 'other'));

COMMENT ON COLUMN public.evidence_files.evidence_type
  IS 'bill=บิล, slip=สลิปพนักงาน, goods_receipt=รูปรับของ, payment_slip=สลิปโอนจากบัญชี, other=อื่นๆ';
