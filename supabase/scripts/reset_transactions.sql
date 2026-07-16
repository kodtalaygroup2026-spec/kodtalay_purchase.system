-- ===========================================================================
-- สคริปต์รีเซ็ตข้อมูลใบสั่งซื้อทั้งหมด (ใช้ซ้ำได้)
--
-- ลบ:   ใบขอซื้อ (PR) / ใบสั่งซื้อ (PO) / การรับของ / บิล / หลักฐานการจ่าย /
--        ไฟล์แนบ / ประวัติแก้ไข / ประวัติการทำรายการ (audit log)
-- คงไว้: ผู้ใช้ บริษัท(สาขา) หมวด สินค้า ผู้ขาย ตำแหน่งผู้อนุมัติ
--        ค่าตั้งค่า KTB และการเชื่อม LINE — ข้อมูลตั้งค่าทั้งหมดไม่ถูกแตะ
--
-- วิธีใช้: เปิด Supabase Dashboard → SQL Editor → วางทั้งไฟล์ → Run
-- ⚠️ ลบแล้วกู้คืนไม่ได้ — ใช้เฉพาะตอนต้องการล้างข้อมูลทดสอบ/เริ่มรอบใหม่
-- ===========================================================================

BEGIN;

-- ── 1) สายการจ่ายเงิน (ลูกก่อนแม่) ─────────────────────────────────────────
DELETE FROM public.evidence_files;      -- ไฟล์แนบของหลักฐานการจ่าย
DELETE FROM public.payment_evidences;   -- หลักฐานการจ่าย

-- ── 2) เอกสารประกอบใบขอซื้อ ─────────────────────────────────────────────────
DELETE FROM public.pr_item_edit_logs;   -- ประวัติแก้ไขรายการสินค้า
DELETE FROM public.pr_attachments;      -- ไฟล์แนบใบขอซื้อ (ใบเสนอราคา ฯลฯ)

-- ── 3) สายใบสั่งซื้อ / รับของ / บิล ─────────────────────────────────────────
DELETE FROM public.gr_items;            -- รายการรับของ
DELETE FROM public.goods_receipts;      -- ใบรับของ
DELETE FROM public.purchase_bills;      -- บิล/ใบแจ้งหนี้
DELETE FROM public.po_attachments;      -- ไฟล์แนบใบสั่งซื้อ
DELETE FROM public.po_items;            -- รายการในใบสั่งซื้อ
DELETE FROM public.approvals;           -- บันทึกการอนุมัติ (ทั้ง PR และ PO)
DELETE FROM public.purchase_orders;     -- ใบสั่งซื้อ

-- ── 4) ใบขอซื้อ (ตัวแม่สุดท้าย) ─────────────────────────────────────────────
DELETE FROM public.pr_items;            -- รายการสินค้าในใบขอซื้อ
DELETE FROM public.purchase_requisitions;

-- ── 5) ประวัติการทำรายการ (ไทม์ไลน์ในหน้าใบสั่ง) ────────────────────────────
DELETE FROM public.audit_logs;

COMMIT;

-- ── ตรวจผล: ทุกตารางต้องเป็น 0 ─────────────────────────────────────────────
SELECT 'purchase_requisitions' AS table_name, count(*) FROM public.purchase_requisitions
UNION ALL SELECT 'pr_items',             count(*) FROM public.pr_items
UNION ALL SELECT 'purchase_orders',      count(*) FROM public.purchase_orders
UNION ALL SELECT 'po_items',             count(*) FROM public.po_items
UNION ALL SELECT 'payment_evidences',    count(*) FROM public.payment_evidences
UNION ALL SELECT 'evidence_files',       count(*) FROM public.evidence_files
UNION ALL SELECT 'pr_attachments',       count(*) FROM public.pr_attachments
UNION ALL SELECT 'audit_logs',           count(*) FROM public.audit_logs;

-- ===========================================================================
-- (ทางเลือก) ล้างไฟล์รูป/เอกสารใน Storage ด้วย — ปกติไม่จำเป็น ไฟล์เก่าแค่
-- ไม่ถูกอ้างถึงแล้ว ถ้าอยากล้างพื้นที่จริงให้ลบผ่าน Dashboard → Storage
-- หรือเอาคอมเมนต์ออกจากบรรทัดล่างนี้ (ลบ object ทุกไฟล์ใน 2 bucket):
--
-- DELETE FROM storage.objects WHERE bucket_id IN ('evidence-attachments', 'pr-attachments');
-- ===========================================================================
