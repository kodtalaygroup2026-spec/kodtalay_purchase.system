-- Migration 0037: เปิดให้ผู้ใช้ (authenticated) เพิ่มหมวดเองได้ (พิมพ์แล้วสร้างใหม่)
-- update/delete ยังจำกัดเฉพาะ admin/manager ตาม policy "categories_write" เดิม

DROP POLICY IF EXISTS "categories_insert" ON public.categories;
CREATE POLICY "categories_insert" ON public.categories
  FOR INSERT TO authenticated
  WITH CHECK (true);
