-- ---------------------------------------------------------------------------
-- 0020: เพิ่ม rejection_reason เก็บเหตุผลเมื่อผู้อนุมัติตีกลับหรือไม่อนุมัติ
-- รัน: Supabase Dashboard → SQL Editor → Run
-- ---------------------------------------------------------------------------

ALTER TABLE public.purchase_requisitions
  ADD COLUMN IF NOT EXISTS rejection_reason text;

COMMENT ON COLUMN public.purchase_requisitions.rejection_reason
  IS 'เหตุผลที่ผู้อนุมัติระบุเมื่อตีกลับหรือไม่อนุมัติใบขอซื้อ';
