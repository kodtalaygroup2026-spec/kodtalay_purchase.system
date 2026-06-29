-- ============================================================
-- Migration 0014: PO Complete Fix (รัน SQL นี้ครั้งเดียวใน Supabase SQL Editor)
-- รวม 0012 + 0013 + แก้ RLS ทั้งหมด รันซ้ำได้ปลอดภัย
-- ============================================================

-- ── 1. po_items: เพิ่ม link กลับไป pr_item + snapshot ราคา PR ──────────
ALTER TABLE public.po_items
  ADD COLUMN IF NOT EXISTS pr_item_id    uuid REFERENCES public.pr_items(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS pr_unit_price numeric(14,2) NOT NULL DEFAULT 0;

-- ── 2. purchase_orders: submitted audit + snapshot ยอดรวม PR + vendor_name ──
ALTER TABLE public.purchase_orders
  ADD COLUMN IF NOT EXISTS submitted_at    timestamptz,
  ADD COLUMN IF NOT EXISTS submitted_by    uuid REFERENCES public.profiles(id),
  ADD COLUMN IF NOT EXISTS pr_total_amount numeric(14,2),
  ADD COLUMN IF NOT EXISTS vendor_name     text;

-- ทำ supplier_id เป็น optional (เผื่อสร้าง PO โดยไม่ต้องเลือก supplier จาก master)
ALTER TABLE public.purchase_orders
  ALTER COLUMN supplier_id DROP NOT NULL;

-- ── 3. ตาราง po_attachments ───────────────────────────────────────────────
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

-- ── 4. แก้ RLS purchase_orders: อนุญาต requester สร้าง/แก้ PO ของตัวเอง ──
DROP POLICY IF EXISTS "po_write" ON public.purchase_orders;

CREATE POLICY "po_write" ON public.purchase_orders
  FOR ALL TO authenticated
  USING (
    current_user_role() IN ('admin', 'purchaser', 'manager')
    OR created_by = auth.uid()
  )
  WITH CHECK (
    current_user_role() IN ('admin', 'purchaser', 'manager')
    OR created_by = auth.uid()
  );

-- ── 5. RLS po_items: อนุญาต owner ของ PO จัดการ items ─────────────────────
DROP POLICY IF EXISTS "po_items_write" ON public.po_items;
DROP POLICY IF EXISTS "po_items_all" ON public.po_items;

CREATE POLICY "po_items_write" ON public.po_items
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.purchase_orders po
      WHERE po.id = po_id
        AND (
          current_user_role() IN ('admin', 'purchaser', 'manager')
          OR po.created_by = auth.uid()
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.purchase_orders po
      WHERE po.id = po_id
        AND (
          current_user_role() IN ('admin', 'purchaser', 'manager')
          OR po.created_by = auth.uid()
        )
    )
  );

-- ============================================================
-- หลังรัน SQL นี้สำเร็จ:
--   1. Settings → API → Reload schema
--   2. Storage → สร้าง bucket ชื่อ "po-attachments" (Public: OFF)
-- ============================================================
