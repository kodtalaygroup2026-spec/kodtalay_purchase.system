-- Migration 0022: เพิ่ม 'employee' เข้า enum user_role
-- ⚠️  รันไฟล์นี้ก่อนเท่านั้น แล้วค่อยรัน 0023 แยกต่างหาก
-- (PostgreSQL บังคับให้ ADD VALUE commit ก่อนจึงใช้ได้)

ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'employee';
