-- Migration 0024: KTB Smart Transfer — settings table + extra columns

-- ── ตารางตั้งค่าบริษัทสำหรับ KTB Smart Business ──────────────────────────────
CREATE TABLE IF NOT EXISTS public.company_ktb_settings (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payer_abbreviation  text NOT NULL DEFAULT '',  -- ≤ 10 ตัวอักษร
  company_name_th     text NOT NULL DEFAULT '',
  company_name_en     text NOT NULL DEFAULT '',
  address             text NOT NULL DEFAULT '',
  province            text NOT NULL DEFAULT '',
  district            text NOT NULL DEFAULT '',
  sub_district        text NOT NULL DEFAULT '',
  postal_code         text NOT NULL DEFAULT '',
  tax_id              text NOT NULL DEFAULT '',  -- 13 หลัก
  ktb_company_id      text NOT NULL DEFAULT '',  -- Company ID ใน KTB Smart Biz
  payer_account       text NOT NULL DEFAULT '',  -- เลขบัญชีต้นทาง 10 หลัก
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.company_ktb_settings
  IS 'ข้อมูลบริษัทสำหรับออกไฟล์ KTB Smart Transfer (1 แถวต่อบริษัท)';

ALTER TABLE public.company_ktb_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ktb_settings_select" ON public.company_ktb_settings
  FOR SELECT TO authenticated
  USING (current_user_role() IN ('admin', 'finance'));

CREATE POLICY "ktb_settings_all" ON public.company_ktb_settings
  FOR ALL TO authenticated
  USING (current_user_role() IN ('admin', 'finance'))
  WITH CHECK (current_user_role() IN ('admin', 'finance'));

-- ── เพิ่ม ktb_branch_code ใน payment_evidences ────────────────────────────────
-- รหัสสาขา KTB ของผู้รับเงิน (4 หลัก)
ALTER TABLE public.payment_evidences
  ADD COLUMN IF NOT EXISTS ktb_branch_code text;

-- ── เพิ่ม ktb_batch_ref ใน purchase_requisitions ─────────────────────────────
-- บันทึก batch number ที่ export ออกไปแล้ว เพื่อป้องกันการจ่ายซ้ำ
ALTER TABLE public.purchase_requisitions
  ADD COLUMN IF NOT EXISTS ktb_batch_ref text;
