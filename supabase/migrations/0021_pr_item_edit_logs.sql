-- ตารางบันทึก log การแก้ไขรายการสินค้าหลังอนุมัติ
CREATE TABLE IF NOT EXISTS public.pr_item_edit_logs (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  pr_id       uuid        NOT NULL REFERENCES public.purchase_requisitions(id) ON DELETE CASCADE,
  edited_by   uuid        REFERENCES public.profiles(id) ON DELETE SET NULL,
  edited_at   timestamptz NOT NULL DEFAULT now(),
  changes     jsonb       NOT NULL DEFAULT '[]'::jsonb
  -- changes: [{item_id, description, quantity_old, quantity_new, unit_price_old, unit_price_new}]
);

ALTER TABLE public.pr_item_edit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated_select" ON public.pr_item_edit_logs
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "owner_insert" ON public.pr_item_edit_logs
  FOR INSERT TO authenticated WITH CHECK (edited_by = auth.uid());
