-- Migration 0034: ปรับหมวดหมู่เป็นชุดใหม่ แบ่ง MODE 1 (จัดซื้อทั่วไป) / MODE 2 (ช่าง)

ALTER TABLE public.categories
  ADD COLUMN IF NOT EXISTS code          text,
  ADD COLUMN IF NOT EXISTS mode          smallint NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS approver_hint text,
  ADD COLUMN IF NOT EXISTS sort_order    smallint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_active     boolean  NOT NULL DEFAULT true;

COMMENT ON COLUMN public.categories.mode          IS '1=จัดซื้อทั่วไป, 2=ช่าง';
COMMENT ON COLUMN public.categories.approver_hint IS 'ผู้อนุมัติตามหมวด (ไว้ทำ auto-route ภายหลัง)';

-- ล้างหมวดเดิม (products.category_id จะถูกตั้งเป็น NULL อัตโนมัติ) แล้ว seed ชุดใหม่
DELETE FROM public.categories;

INSERT INTO public.categories (code, name, mode, approver_hint, sort_order, is_active) VALUES
  ('FOOD COST',   'วัตถุดิบอาหาร',          1, 'P''ด้า',            1, true),
  ('DELIV',       'ค่าขนส่งสินค้าทั้งหมด',  1, 'P''ด้า',            2, true),
  ('MKT',         'งบการตลาด',              1, 'P''ANQI',           3, true),
  ('SUPPLIES',    'วัสดุสิ้นเปลืองร้าน',    1, 'P''TAN',            4, true),
  ('TEMP',        'ค่าแรงพนักงานชั่วคราว',  1, 'HR_MEW',            5, true),
  ('TRANS & ACC', 'การเดินทางและที่พัก',    1, 'HR_MEW',            6, true),
  ('WELFARE',     'ค่าสวัสดิการพนักงาน',    1, 'HR_MEW',            7, true),
  ('CONTRACT',    'จ้างรับเหมา',            2, 'P''KAEW & P''BANK',  8, false),
  ('FIX ASSET',   'อุปกรณ์ใช้งาน>1ปี',      2, 'P''KAEW',           9, false),
  ('REPAIR',      'งานจ้างซ่อม',            2, 'P''KAEW',          10, false);
