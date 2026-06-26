-- ============================================================
-- Seed: สร้างตาราง branches + เพิ่ม 3 บริษัท
-- รันใน Supabase Dashboard → SQL Editor
-- ============================================================

-- 1. สร้างตาราง branches (ถ้ายังไม่มี)
CREATE TABLE IF NOT EXISTS public.branches (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  code       text        UNIQUE NOT NULL,
  name       text        NOT NULL,
  is_active  boolean     NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 2. เปิด RLS
ALTER TABLE public.branches ENABLE ROW LEVEL SECURITY;

-- 3. Policy: ทุกคนที่ login อ่านได้
DROP POLICY IF EXISTS "branches_select" ON public.branches;
CREATE POLICY "branches_select" ON public.branches
  FOR SELECT TO authenticated USING (true);

-- 4. เพิ่ม branch_id ใน profiles (ถ้ายังไม่มี column)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS branch_id uuid REFERENCES public.branches(id) ON DELETE SET NULL;

-- 5. Seed 3 บริษัท
INSERT INTO public.branches (code, name) VALUES
  ('CK',  'KOD CK'),
  ('BN',  'KOD BN'),
  ('RCA', 'KOD RCA GROUP')
ON CONFLICT (code) DO NOTHING;

-- ตรวจสอบผลลัพธ์
SELECT id, code, name, is_active FROM public.branches ORDER BY code;
