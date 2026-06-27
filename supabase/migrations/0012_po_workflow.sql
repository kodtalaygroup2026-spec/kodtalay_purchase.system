-- ============================================================
-- Migration 0012: PO Workflow
-- เพิ่ม columns สำหรับ PR→PO link, ราคาอ้างอิง, audit และ po_attachments
-- รัน: Supabase Dashboard → SQL Editor → Run → Reload schema
-- ============================================================

-- po_items: เก็บ reference กลับไป pr_item + ราคา PR ณ เวลาสั่ง
ALTER TABLE public.po_items
  ADD COLUMN IF NOT EXISTS pr_item_id    uuid REFERENCES public.pr_items(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS pr_unit_price numeric(14,2) NOT NULL DEFAULT 0;

-- purchase_orders: submitted audit + snapshot ยอดรวม PR ณ เวลาสร้าง PO
ALTER TABLE public.purchase_orders
  ADD COLUMN IF NOT EXISTS submitted_at    timestamptz,
  ADD COLUMN IF NOT EXISTS submitted_by    uuid REFERENCES public.profiles(id),
  ADD COLUMN IF NOT EXISTS pr_total_amount numeric(14,2);

-- ตาราง po_attachments: บิล/ใบเสร็จแนบกับ PO
CREATE TABLE IF NOT EXISTS public.po_attachments (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  po_id       uuid        NOT NULL REFERENCES public.purchase_orders(id) ON DELETE CASCADE,
  file_name   text        NOT NULL,
  file_url    text        NOT NULL,
  file_type   text        NOT NULL CHECK (file_type IN ('image', 'pdf')),
  file_size   integer,
  uploaded_by uuid        REFERENCES public.profiles(id),
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_po_attachments_po ON public.po_attachments(po_id);
ALTER TABLE public.po_attachments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "po_attachments_select" ON public.po_attachments;
DROP POLICY IF EXISTS "po_attachments_insert" ON public.po_attachments;

CREATE POLICY "po_attachments_select" ON public.po_attachments
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "po_attachments_insert" ON public.po_attachments
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = uploaded_by);

-- ============================================================
-- หมายเหตุ: หลังรัน SQL นี้สำเร็จ
--   1. Settings → API → Reload schema
--   2. Storage → New bucket → ชื่อ "po-attachments" (Public: OFF)
-- ============================================================
