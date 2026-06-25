-- ============================================================================
-- File: supabase/seed.sql
-- คำอธิบาย: ข้อมูลตัวอย่างสำหรับทดสอบระบบ (รันหลัง 0001_init.sql)
-- หมายเหตุ: profiles จะถูกสร้างอัตโนมัติเมื่อสมัครผู้ใช้ผ่าน Supabase Auth
--          ไฟล์นี้จึง seed เฉพาะ master data ที่ไม่ผูกกับ auth.users
-- ============================================================================

-- หมวดหมู่สินค้า
insert into public.categories (name, description) values
  ('อุปกรณ์สำนักงาน', 'เครื่องเขียน กระดาษ วัสดุสิ้นเปลือง'),
  ('อุปกรณ์ไอที', 'คอมพิวเตอร์ อุปกรณ์ต่อพ่วง'),
  ('บริการ', 'งานจ้างเหมาบริการต่าง ๆ');

-- ผู้ขายตัวอย่าง
insert into public.suppliers (code, name, tax_id, contact_name, phone, email) values
  ('SUP-0001', 'บริษัท ออฟฟิศเมท จำกัด', '0105540001234', 'คุณสมชาย', '02-111-1111', 'sales@officemate.example'),
  ('SUP-0002', 'บริษัท ไอทีโซลูชั่น จำกัด', '0105540005678', 'คุณสมหญิง', '02-222-2222', 'info@itsolution.example');

-- สินค้าตัวอย่าง (ผูกกับหมวดหมู่แรก ๆ)
insert into public.products (sku, name, category_id, unit, unit_price)
select 'P-0001', 'กระดาษ A4 80 แกรม', id, 'รีม', 120.00
from public.categories where name = 'อุปกรณ์สำนักงาน' limit 1;

insert into public.products (sku, name, category_id, unit, unit_price)
select 'P-0002', 'เมาส์ไร้สาย', id, 'ชิ้น', 350.00
from public.categories where name = 'อุปกรณ์ไอที' limit 1;
