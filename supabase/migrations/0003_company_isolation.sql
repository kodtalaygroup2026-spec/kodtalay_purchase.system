-- ============================================================
-- Migration 0003: Company-level Data Isolation
-- แยกข้อมูลตามบริษัท (KOD CK / KOD BN / KOD RCA GROUP)
-- Idempotent — รันซ้ำได้ไม่ error
-- ============================================================

-- ------------------------------------------------------------
-- 1. Helper: ดึง branch_id ของ user ที่ login อยู่
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION current_user_branch_id()
RETURNS uuid LANGUAGE sql STABLE
SECURITY DEFINER SET search_path = public AS $$
  SELECT branch_id FROM public.profiles WHERE id = auth.uid();
$$;

-- ------------------------------------------------------------
-- 2. เพิ่ม branch_id ให้ purchase_requisitions
--    (nullable เพื่อ backward compat กับข้อมูลเดิม)
-- ------------------------------------------------------------
ALTER TABLE public.purchase_requisitions
  ADD COLUMN IF NOT EXISTS branch_id uuid REFERENCES public.branches(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_pr_branch ON public.purchase_requisitions (branch_id);

-- ------------------------------------------------------------
-- 3. อัปเดต RLS: expense_requests — แยกตามบริษัท
--    admin เห็นทุกบริษัท, คนอื่นเห็นแค่บริษัทตัวเอง
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "expense_requests_select" ON public.expense_requests;
CREATE POLICY "expense_requests_select" ON public.expense_requests
  FOR SELECT TO authenticated
  USING (
    current_user_role() = 'admin'
    OR branch_id = current_user_branch_id()
  );

DROP POLICY IF EXISTS "expense_requests_insert" ON public.expense_requests;
CREATE POLICY "expense_requests_insert" ON public.expense_requests
  FOR INSERT TO authenticated
  WITH CHECK (
    requester_id = auth.uid()
    AND (
      branch_id = current_user_branch_id()
      OR current_user_role() = 'admin'
    )
  );

DROP POLICY IF EXISTS "expense_requests_update" ON public.expense_requests;
CREATE POLICY "expense_requests_update" ON public.expense_requests
  FOR UPDATE TO authenticated
  USING (
    (requester_id = auth.uid() OR current_user_role() IN ('admin', 'manager'))
    AND (
      branch_id = current_user_branch_id()
      OR current_user_role() = 'admin'
    )
  );

-- ------------------------------------------------------------
-- 4. อัปเดต RLS: expense_items — ตาม parent expense
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "expense_items_select" ON public.expense_items;
CREATE POLICY "expense_items_select" ON public.expense_items
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.expense_requests er
      WHERE er.id = expense_id
        AND (
          current_user_role() = 'admin'
          OR er.branch_id = current_user_branch_id()
        )
    )
  );

DROP POLICY IF EXISTS "expense_items_insert" ON public.expense_items;
CREATE POLICY "expense_items_insert" ON public.expense_items
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.expense_requests er
      WHERE er.id = expense_id
        AND (er.requester_id = auth.uid() OR current_user_role() IN ('admin', 'manager'))
        AND (er.branch_id = current_user_branch_id() OR current_user_role() = 'admin')
    )
  );

DROP POLICY IF EXISTS "expense_items_update" ON public.expense_items;
CREATE POLICY "expense_items_update" ON public.expense_items
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.expense_requests er
      WHERE er.id = expense_id
        AND (er.requester_id = auth.uid() OR current_user_role() IN ('admin', 'manager'))
        AND (er.branch_id = current_user_branch_id() OR current_user_role() = 'admin')
    )
  );

DROP POLICY IF EXISTS "expense_items_delete" ON public.expense_items;
CREATE POLICY "expense_items_delete" ON public.expense_items
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.expense_requests er
      WHERE er.id = expense_id
        AND (er.requester_id = auth.uid() OR current_user_role() IN ('admin', 'manager'))
        AND (er.branch_id = current_user_branch_id() OR current_user_role() = 'admin')
    )
  );

-- ------------------------------------------------------------
-- 5. อัปเดต RLS: purchase_requisitions — แยกตามบริษัทด้วย
--    (ใช้ branch_id ถ้ามี, ถ้า NULL ให้ admin ยังเห็นได้)
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "pr_select" ON public.purchase_requisitions;
CREATE POLICY "pr_select" ON public.purchase_requisitions
  FOR SELECT TO authenticated
  USING (
    current_user_role() = 'admin'
    OR branch_id IS NULL
    OR branch_id = current_user_branch_id()
  );

DROP POLICY IF EXISTS "pr_insert" ON public.purchase_requisitions;
CREATE POLICY "pr_insert" ON public.purchase_requisitions
  FOR INSERT TO authenticated
  WITH CHECK (requester_id = auth.uid());

DROP POLICY IF EXISTS "pr_update" ON public.purchase_requisitions;
CREATE POLICY "pr_update" ON public.purchase_requisitions
  FOR UPDATE TO authenticated
  USING (
    requester_id = auth.uid() OR current_user_role() IN ('admin', 'manager')
  )
  WITH CHECK (
    requester_id = auth.uid() OR current_user_role() IN ('admin', 'manager')
  );

-- ============================================================
-- Verification: ตรวจสอบว่าทุกอย่างถูกสร้างสำเร็จ
-- ============================================================
DO $$
DECLARE
  v_ok boolean := true;
BEGIN
  -- ตรวจ branches
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'branches') THEN
    RAISE EXCEPTION 'ERROR: ตาราง branches ไม่มี — รัน 0002 ก่อน';
  END IF;

  -- ตรวจ expense_requests
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'expense_requests') THEN
    RAISE EXCEPTION 'ERROR: ตาราง expense_requests ไม่มี — รัน 0002 ก่อน';
  END IF;

  -- ตรวจ seed branches
  IF (SELECT COUNT(*) FROM public.branches) = 0 THEN
    RAISE WARNING 'WARNING: ไม่มีข้อมูล branches — กำลัง seed ข้อมูลเริ่มต้น';
    INSERT INTO public.branches (code, name) VALUES
      ('CK',  'KOD CK'),
      ('BN',  'KOD BN'),
      ('RCA', 'KOD RCA GROUP')
    ON CONFLICT (code) DO NOTHING;
  END IF;

  -- ตรวจ function
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc WHERE proname = 'current_user_branch_id'
  ) THEN
    RAISE EXCEPTION 'ERROR: function current_user_branch_id() ไม่ถูกสร้าง';
  END IF;

  RAISE NOTICE 'Migration 0003 สำเร็จ — company isolation พร้อมใช้งาน';
END $$;
