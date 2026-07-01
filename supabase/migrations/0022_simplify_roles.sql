-- Migration 0022: Simplify roles → admin | manager | employee | finance
-- เหตุผล: ลด role จาก 6 → 4 ให้ตรงกับการใช้งานจริงในองค์กร
--   - employee   แทน requester (พนักงานสร้าง PR)
--   - manager    รับงาน purchaser เพิ่ม (อนุมัติ + สร้าง PO)
--   - ลบออก: purchaser, viewer (ไม่มีใน business flow จริง)

-- ─── 1. เพิ่ม enum value ใหม่ ──────────────────────────────────────────────
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'employee';

-- ─── 2. Migrate ข้อมูลที่มีอยู่ ──────────────────────────────────────────
-- ต้อง commit enum ก่อนจึงใช้ใน UPDATE ได้ → แยก statement
-- (Supabase dashboard รัน statement-by-statement อยู่แล้ว)

UPDATE public.profiles
SET role = 'employee'
WHERE role IN ('requester', 'purchaser', 'viewer');

-- ─── 3. เปลี่ยน column default ────────────────────────────────────────────
ALTER TABLE public.profiles
  ALTER COLUMN role SET DEFAULT 'employee';

-- ─── 4. อัปเดต trigger ให้ user คนใหม่ได้ employee ────────────────────────
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public AS $$
DECLARE
  profile_count int;
  assigned_role user_role;
BEGIN
  SELECT COUNT(*) INTO profile_count FROM public.profiles;

  -- user คนแรก → admin อัตโนมัติ
  -- user คนถัดมา → employee เป็น default
  IF profile_count = 0 THEN
    assigned_role := 'admin'::user_role;
  ELSE
    assigned_role := 'employee'::user_role;
  END IF;

  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (
    new.id,
    new.email,
    COALESCE(new.raw_user_meta_data->>'full_name', ''),
    assigned_role
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN new;
END;
$$;

-- ─── 5. อัปเดต RLS policy: purchaser → manager ────────────────────────────
-- products
DROP POLICY IF EXISTS "Purchaser can insert products" ON public.products;
DROP POLICY IF EXISTS "Purchaser can update products" ON public.products;

CREATE POLICY "Manager can insert products" ON public.products
  FOR INSERT TO authenticated
  WITH CHECK (current_user_role() IN ('admin', 'manager'));

CREATE POLICY "Manager can update products" ON public.products
  FOR UPDATE TO authenticated
  USING (current_user_role() IN ('admin', 'manager'))
  WITH CHECK (current_user_role() IN ('admin', 'manager'));

-- purchase_orders
DROP POLICY IF EXISTS "Purchaser can manage PO" ON public.purchase_orders;
DROP POLICY IF EXISTS "Purchaser can view PO" ON public.purchase_orders;

CREATE POLICY "Manager can manage PO" ON public.purchase_orders
  FOR ALL TO authenticated
  USING (current_user_role() IN ('admin', 'manager'))
  WITH CHECK (current_user_role() IN ('admin', 'manager'));

-- po_items
DROP POLICY IF EXISTS "Purchaser can manage PO items" ON public.po_items;

CREATE POLICY "Manager can manage PO items" ON public.po_items
  FOR ALL TO authenticated
  USING (current_user_role() IN ('admin', 'manager'))
  WITH CHECK (current_user_role() IN ('admin', 'manager'));
