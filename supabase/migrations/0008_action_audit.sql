-- Migration 0008: Action Audit Trail
-- บันทึก ใคร ทำอะไร เมื่อไหร่ (วัน + เวลา) ในทุกการเปลี่ยนสถานะ

-- ใบขอซื้อ (PR) — เพิ่ม audit columns
ALTER TABLE public.purchase_requisitions
  ADD COLUMN IF NOT EXISTS submitted_at   timestamptz,
  ADD COLUMN IF NOT EXISTS submitted_by   uuid REFERENCES public.profiles(id),
  ADD COLUMN IF NOT EXISTS approved_at    timestamptz,
  ADD COLUMN IF NOT EXISTS approved_by    uuid REFERENCES public.profiles(id),
  ADD COLUMN IF NOT EXISTS rejected_at    timestamptz,
  ADD COLUMN IF NOT EXISTS rejected_by    uuid REFERENCES public.profiles(id),
  ADD COLUMN IF NOT EXISTS cancelled_at   timestamptz,
  ADD COLUMN IF NOT EXISTS cancelled_by   uuid REFERENCES public.profiles(id);

-- ใบสั่งซื้อ (PO) — เพิ่ม audit columns
ALTER TABLE public.purchase_orders
  ADD COLUMN IF NOT EXISTS approved_at    timestamptz,
  ADD COLUMN IF NOT EXISTS approved_by    uuid REFERENCES public.profiles(id),
  ADD COLUMN IF NOT EXISTS cancelled_at   timestamptz,
  ADD COLUMN IF NOT EXISTS cancelled_by   uuid REFERENCES public.profiles(id);

