-- Migration 0009: เปลี่ยน needed_by จาก date → timestamptz
-- เพื่อเก็บทั้งวันและเวลาที่ต้องการสินค้า

ALTER TABLE public.purchase_requisitions
  ALTER COLUMN needed_by TYPE timestamptz
  USING needed_by::timestamptz;
