-- Migration 0013: เปลี่ยน supplier เป็น vendor_name (free text)
-- purchase_orders: เพิ่ม vendor_name + ทำ supplier_id เป็น optional
ALTER TABLE public.purchase_orders
  ADD COLUMN IF NOT EXISTS vendor_name text,
  ALTER COLUMN supplier_id DROP NOT NULL;
