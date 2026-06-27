-- Migration 0010: เพิ่มช่องบัญชีธนาคารและไฟล์แนบใน PR

-- บัญชีธนาคารสำหรับโอนเงินคืน/รับเงิน
ALTER TABLE public.purchase_requisitions
  ADD COLUMN IF NOT EXISTS bank_name           text,
  ADD COLUMN IF NOT EXISTS bank_account_number text;

-- ตารางไฟล์แนบของ PR (รองรับหลายไฟล์ต่อ PR)
CREATE TABLE IF NOT EXISTS public.pr_attachments (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pr_id        uuid NOT NULL REFERENCES public.purchase_requisitions(id) ON DELETE CASCADE,
  file_name    text NOT NULL,
  file_url     text NOT NULL,
  file_type    text NOT NULL CHECK (file_type IN ('image', 'pdf')),
  file_size    integer,
  uploaded_by  uuid REFERENCES public.profiles(id),
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pr_attachments_pr ON public.pr_attachments (pr_id);

-- RLS
ALTER TABLE public.pr_attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pr_attachments_select" ON public.pr_attachments
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "pr_attachments_insert" ON public.pr_attachments
  FOR INSERT WITH CHECK (auth.uid() = uploaded_by);

-- หมายเหตุ: สร้าง Storage bucket "pr-attachments" ใน Supabase Dashboard
--   Storage → New Bucket → Name: pr-attachments → Public: OFF
--   Policy: authenticated users can upload/read
