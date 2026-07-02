-- Migration 0025: แก้ RLS policies ที่ยังอ้างถึง role 'purchaser' ที่ลบออกไปแล้ว
-- ผลกระทบ: manager ไม่สามารถ write ไปยัง suppliers, categories, goods_receipts,
--           gr_items, purchase_bills ได้เลย เพราะ policy ต้องการ 'purchaser' ซึ่งไม่มีแล้ว

-- ─── suppliers ─────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "suppliers_write" ON public.suppliers;
CREATE POLICY "suppliers_write" ON public.suppliers
  FOR ALL TO authenticated
  USING (current_user_role() IN ('admin', 'manager'))
  WITH CHECK (current_user_role() IN ('admin', 'manager'));

-- ─── categories ────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "categories_write" ON public.categories;
CREATE POLICY "categories_write" ON public.categories
  FOR ALL TO authenticated
  USING (current_user_role() IN ('admin', 'manager'))
  WITH CHECK (current_user_role() IN ('admin', 'manager'));

-- ─── goods_receipts ────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "gr_write" ON public.goods_receipts;
CREATE POLICY "gr_write" ON public.goods_receipts
  FOR ALL TO authenticated
  USING (current_user_role() IN ('admin', 'manager'))
  WITH CHECK (current_user_role() IN ('admin', 'manager'));

-- ─── gr_items ──────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "gr_items_write" ON public.gr_items;
CREATE POLICY "gr_items_write" ON public.gr_items
  FOR ALL TO authenticated
  USING (current_user_role() IN ('admin', 'manager'))
  WITH CHECK (current_user_role() IN ('admin', 'manager'));

-- ─── purchase_bills ────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "purchase_bills_update" ON public.purchase_bills;
DROP POLICY IF EXISTS "purchase_bills_delete" ON public.purchase_bills;

CREATE POLICY "purchase_bills_update" ON public.purchase_bills
  FOR UPDATE TO authenticated
  USING (
    auth.uid() = created_by
    OR current_user_role() IN ('admin', 'manager')
  );

CREATE POLICY "purchase_bills_delete" ON public.purchase_bills
  FOR DELETE TO authenticated
  USING (current_user_role() IN ('admin', 'manager'));
