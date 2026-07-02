-- 0030: เพิ่มชื่อเจ้าของบัญชีธนาคารในโปรไฟล์ (แยกจาก full_name)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS bank_account_holder_name text;
