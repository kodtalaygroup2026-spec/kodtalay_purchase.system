-- ===========================================================================
-- สคริปต์รีเซ็ต "งาน / ใบเบิก" ทั้งหมด (ใช้ซ้ำได้)
--
-- ลบทุกงาน/ใบเบิกที่เคยสร้าง:
--   • ใบขอซื้อ (PR)      — รายการ + ไฟล์แนบ + ประวัติแก้ไข
--   • ใบสั่งซื้อ (PO)     — รายการ + ไฟล์แนบ + บิล
--   • การรับของ (GR)
--   • หลักฐานการจ่าย     — ไฟล์แนบ
--   • ใบเบิกค่าใช้จ่าย    — expense_requests + expense_items
--   • งานช่าง            — construction_tickets + BOQ + VO + ใบเบิกงวดงาน
--   • บันทึกการอนุมัติ + ประวัติการทำรายการ (audit log)
-- คงไว้: ผู้ใช้ / บริษัท(สาขา) / หมวด / สินค้า / ผู้ขาย / ตำแหน่งผู้อนุมัติ /
--        ค่าตั้งค่า KTB / การเชื่อม LINE — ข้อมูลตั้งค่าทั้งหมดไม่ถูกแตะ
--
-- วิธีใช้: Supabase Dashboard → SQL Editor → วางทั้งไฟล์ → Run
-- ⚠️ ลบแล้วกู้คืนไม่ได้ — ใช้เฉพาะตอนต้องการล้างข้อมูลทดสอบ/เริ่มรอบใหม่
--
-- ปลอดภัย: ลบแบบเรียงลูกก่อนแม่ (ตาม FK) และ "ข้ามตารางที่ยังไม่ได้ติดตั้ง"
--          ในฐานนี้โดยอัตโนมัติ (เช่น โมดูล expense/construction ที่บางฐานยัง
--          ไม่เปิดใช้) — ทั้งชุดเป็น transaction เดียว ถ้าพลาดจะย้อนกลับทั้งหมด
-- ===========================================================================

DO $$
DECLARE
  target  text;
  deleted bigint;
  -- เรียง "ลูกก่อนแม่" — ตารางที่ถือ foreign key ต้องถูกลบก่อนตารางแม่
  targets text[] := ARRAY[
    -- ── สายการจ่ายเงิน ────────────────────────────────────────────────
    'evidence_files',
    'payment_evidences',
    -- ── เอกสารประกอบใบขอซื้อ ──────────────────────────────────────────
    'pr_item_edit_logs',
    'pr_attachments',
    -- ── สายใบสั่งซื้อ / รับของ / บิล ──────────────────────────────────
    'gr_items',
    'goods_receipts',
    'purchase_bills',
    'po_attachments',
    'po_items',
    'approvals',
    'purchase_orders',
    -- ── ใบขอซื้อ ──────────────────────────────────────────────────────
    'pr_items',
    'purchase_requisitions',
    -- ── ใบเบิกค่าใช้จ่าย (expense module) ─────────────────────────────
    'expense_items',
    'expense_requests',
    -- ── งานช่าง (construction module) ─────────────────────────────────
    'construction_payment_requests',
    'boq_items',
    'variation_orders',
    'construction_tickets',
    -- ── ประวัติการทำรายการ ────────────────────────────────────────────
    'audit_logs'
  ];
BEGIN
  FOREACH target IN ARRAY targets LOOP
    IF to_regclass('public.' || target) IS NULL THEN
      RAISE NOTICE 'ข้าม (ยังไม่ได้ติดตั้ง): %', target;
      CONTINUE;
    END IF;
    EXECUTE format('DELETE FROM public.%I', target);
    GET DIAGNOSTICS deleted = ROW_COUNT;
    RAISE NOTICE 'ลบแล้ว %  (% แถว)', target, deleted;
  END LOOP;
END $$;

-- ── ตรวจผล: ทุกตารางที่มีอยู่ต้องเป็น 0 แถว ────────────────────────────────
-- นับเฉพาะตารางที่ติดตั้งจริง (เลี่ยง error ถ้าบางโมดูลยังไม่เปิดใช้)
DO $$
DECLARE
  target text;
  remain bigint;
  targets text[] := ARRAY[
    'purchase_requisitions','pr_items','purchase_orders','po_items','po_attachments',
    'purchase_bills','goods_receipts','gr_items','approvals',
    'payment_evidences','evidence_files','pr_attachments','pr_item_edit_logs',
    'expense_requests','expense_items',
    'construction_tickets','construction_payment_requests','boq_items','variation_orders',
    'audit_logs'
  ];
BEGIN
  FOREACH target IN ARRAY targets LOOP
    IF to_regclass('public.' || target) IS NULL THEN CONTINUE; END IF;
    EXECUTE format('SELECT count(*) FROM public.%I', target) INTO remain;
    RAISE NOTICE 'คงเหลือ %  = % แถว', target, remain;
  END LOOP;
END $$;

-- ===========================================================================
-- (ทางเลือก) ล้างไฟล์รูป/เอกสารใน Storage ด้วย — ปกติไม่จำเป็น ไฟล์เก่าแค่
-- ไม่ถูกอ้างถึงแล้ว ถ้าอยากล้างพื้นที่จริงให้เอาคอมเมนต์ออกจากบรรทัดล่างนี้
-- (ลบ object ทุกไฟล์ใน bucket ที่เกี่ยวกับงาน — ปรับชื่อ bucket ตามที่มีจริง):
--
-- DELETE FROM storage.objects
--  WHERE bucket_id IN ('evidence-attachments','pr-attachments','po-attachments','payment-slips');
-- ===========================================================================
