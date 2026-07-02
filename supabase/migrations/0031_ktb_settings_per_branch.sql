-- Migration 0031: แยก KTB Settings เป็นของแต่ละบริษัท (branch)
-- เดิม company_ktb_settings เก็บแถวเดียว (global) → เปลี่ยนเป็น 1 แถวต่อ 1 บริษัท

ALTER TABLE public.company_ktb_settings
  ADD COLUMN IF NOT EXISTS branch_id uuid REFERENCES public.branches(id) ON DELETE CASCADE;

-- 1 บริษัทมีได้ 1 setting เท่านั้น (อนุญาต legacy row เดิมที่ branch_id เป็น NULL ได้ 1 แถว)
CREATE UNIQUE INDEX IF NOT EXISTS uq_ktb_settings_branch
  ON public.company_ktb_settings (branch_id)
  WHERE branch_id IS NOT NULL;

COMMENT ON COLUMN public.company_ktb_settings.branch_id
  IS 'บริษัท (สาขา) ที่ setting นี้เป็นเจ้าของ — NULL = legacy global row';
