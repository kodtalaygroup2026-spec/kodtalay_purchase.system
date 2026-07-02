-- Migration 0032: เพิ่มสถานะ + ข้อมูลการตรวจของฝ่ายการเงินใน payment_evidences
-- รองรับ: ตีกลับ (returned), ยกเลิก (cancelled), จ่ายแล้ว (paid)

ALTER TABLE public.payment_evidences
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'submitted'
    CHECK (status IN ('submitted', 'returned', 'paid', 'cancelled')),
  ADD COLUMN IF NOT EXISTS review_note  text,
  ADD COLUMN IF NOT EXISTS reviewed_by  uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS reviewed_at  timestamptz;

-- backfill: evidence ของ PR ที่จ่ายแล้วให้เป็น 'paid'
UPDATE public.payment_evidences ev
SET status = 'paid'
FROM public.purchase_requisitions pr
WHERE ev.pr_id = pr.id
  AND pr.status = 'paid'
  AND ev.status = 'submitted';

CREATE INDEX IF NOT EXISTS idx_payment_evidences_pr_status
  ON public.payment_evidences (pr_id, status);

COMMENT ON COLUMN public.payment_evidences.status
  IS 'สถานะหลักฐาน: submitted=รอตรวจ, returned=ตีกลับให้แก้, paid=จ่ายแล้ว, cancelled=ยกเลิก';

-- ให้ realtime payload.old มีค่า status เดิม (ใช้ตรวจจับ "ตีกลับการจ่าย" pending_finance→approved)
ALTER TABLE public.purchase_requisitions REPLICA IDENTITY FULL;
