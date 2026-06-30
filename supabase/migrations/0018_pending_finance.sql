-- Migration 0018: เพิ่มสถานะ pending_finance, paid และ actual_amount สำหรับกระบวนการแนบจ่าย

-- 1. เพิ่มค่า pending_finance และ paid ใน pr_status enum
DO $$
BEGIN
  ALTER TYPE pr_status ADD VALUE IF NOT EXISTS 'pending_finance';
EXCEPTION WHEN others THEN NULL;
END$$;

DO $$
BEGIN
  ALTER TYPE pr_status ADD VALUE IF NOT EXISTS 'paid';
EXCEPTION WHEN others THEN NULL;
END$$;

-- 2. เพิ่ม actual_amount ใน purchase_requisitions (ถ้ายังไม่มี)
ALTER TABLE public.purchase_requisitions
  ADD COLUMN IF NOT EXISTS actual_amount numeric(14, 2);

-- 3. เพิ่ม actual_amount ใน payment_evidences
ALTER TABLE public.payment_evidences
  ADD COLUMN IF NOT EXISTS actual_amount numeric(14, 2);

-- 4. ทำให้ po_id ใน payment_evidences เป็น nullable (กรณียังไม่ได้ทำ)
ALTER TABLE public.payment_evidences
  ALTER COLUMN po_id DROP NOT NULL;

-- 5. เพิ่ม finance_note และ finance_action_at สำหรับบันทึกการดำเนินการของการเงิน
ALTER TABLE public.purchase_requisitions
  ADD COLUMN IF NOT EXISTS finance_note text,
  ADD COLUMN IF NOT EXISTS finance_action_at timestamptz,
  ADD COLUMN IF NOT EXISTS finance_action_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL;
