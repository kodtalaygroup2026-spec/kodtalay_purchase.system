-- Migration 0036: PR ผูกกับหมวดหมู่ (เพื่อ route ผู้อนุมัติตามตำแหน่งของหมวด)

ALTER TABLE public.purchase_requisitions
  ADD COLUMN IF NOT EXISTS category_id uuid REFERENCES public.categories(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_pr_category ON public.purchase_requisitions (category_id);

COMMENT ON COLUMN public.purchase_requisitions.category_id
  IS 'หมวดของใบขอซื้อ — ใช้หาตำแหน่งผู้อนุมัติ (categories.position_id)';
