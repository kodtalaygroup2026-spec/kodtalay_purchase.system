-- ============================================================
-- 0028: เปิด Supabase Realtime สำหรับ purchase_requisitions
-- จำเป็นสำหรับ real-time notification เมื่อ PR status เปลี่ยน
-- ============================================================
ALTER PUBLICATION supabase_realtime ADD TABLE public.purchase_requisitions;
