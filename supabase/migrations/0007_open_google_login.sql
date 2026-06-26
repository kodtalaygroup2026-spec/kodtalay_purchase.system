-- Migration 0007: Open Google Login + First-user Admin
-- รันใน Supabase Dashboard > SQL Editor
--
-- สิ่งที่ migration นี้ทำ:
-- 1. อัปเดต handle_new_user trigger ให้ผู้ login ผ่าน Google คนแรก = admin อัตโนมัติ
-- 2. ผู้ login คนถัดมาทั้งหมด = requester (พนักงาน) เป็น default
-- 3. Admin เปลี่ยน role ได้ทีหลังที่หน้า /settings/users

-- อัปเดต trigger function
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public AS $$
DECLARE
  profile_count int;
  assigned_role user_role;
BEGIN
  -- นับจำนวน profile ที่มีอยู่ก่อนสร้างใหม่
  SELECT COUNT(*) INTO profile_count FROM public.profiles;

  -- user คนแรกที่เข้าระบบ → admin อัตโนมัติ
  -- user คนต่อมา → requester (พนักงาน) เป็น default
  IF profile_count = 0 THEN
    assigned_role := 'admin'::user_role;
  ELSE
    assigned_role := 'requester'::user_role;
  END IF;

  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (
    new.id,
    new.email,
    COALESCE(new.raw_user_meta_data->>'full_name', ''),
    assigned_role
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN new;
END;
$$;

-- ---------------------------------------------------------------------------
-- ถ้าคุณเป็นผู้ใช้คนแรกที่ login ไปแล้วแต่ได้ role = requester
-- ให้รัน SQL ด้านล่างนี้เพื่อเปลี่ยนตัวเองเป็น admin:
--
-- UPDATE public.profiles
-- SET role = 'admin'
-- WHERE email = 'your-email@gmail.com';
-- ---------------------------------------------------------------------------
