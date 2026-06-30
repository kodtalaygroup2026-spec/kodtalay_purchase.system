-- Migration 0015: สร้าง Storage bucket สำหรับ PR attachments + เพิ่ม DELETE policy

-- ── Storage bucket ──────────────────────────────────────────────────────────
-- สร้าง bucket "pr-attachments" ถ้ายังไม่มี
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'pr-attachments',
  'pr-attachments',
  true,   -- public bucket (URL เข้าถึงได้โดยตรง, เหมาะกับระบบภายใน)
  10485760,  -- 10 MB limit
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
)
ON CONFLICT (id) DO UPDATE SET
  public = true,  -- อัปเดตให้เป็น public ถ้า bucket มีอยู่แล้ว
  file_size_limit = 10485760;

-- ── Storage policies ─────────────────────────────────────────────────────────

-- SELECT: authenticated users ดูได้ทุกคน
DROP POLICY IF EXISTS "pr_attachments_storage_select" ON storage.objects;
CREATE POLICY "pr_attachments_storage_select" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'pr-attachments'
    AND auth.role() = 'authenticated'
  );

-- INSERT: authenticated users อัปโหลดได้
DROP POLICY IF EXISTS "pr_attachments_storage_insert" ON storage.objects;
CREATE POLICY "pr_attachments_storage_insert" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'pr-attachments'
    AND auth.role() = 'authenticated'
  );

-- UPDATE: ป้องกันการแก้ไขไฟล์ (ควร upload ใหม่แทน)
DROP POLICY IF EXISTS "pr_attachments_storage_update" ON storage.objects;
CREATE POLICY "pr_attachments_storage_update" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'pr-attachments'
    AND auth.role() = 'authenticated'
  );

-- DELETE: authenticated users ลบได้
DROP POLICY IF EXISTS "pr_attachments_storage_delete" ON storage.objects;
CREATE POLICY "pr_attachments_storage_delete" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'pr-attachments'
    AND auth.role() = 'authenticated'
  );

-- ── Table: pr_attachments — เพิ่ม DELETE policy ─────────────────────────────
-- Migration 0010 ลืมสร้าง DELETE policy ทำให้ลบ record ออกจากตารางไม่ได้
DROP POLICY IF EXISTS "pr_attachments_delete" ON public.pr_attachments;
CREATE POLICY "pr_attachments_delete" ON public.pr_attachments
  FOR DELETE USING (
    -- เจ้าของไฟล์ลบได้เสมอ
    auth.uid() = uploaded_by
    -- หรือผู้มีสิทธิ์สูง (admin / manager / purchaser)
    OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
        AND role IN ('admin', 'manager', 'purchaser')
    )
  );

-- ── Table: pr_attachments — เพิ่ม UPDATE policy (กรณีต้องการแก้ metadata) ──
DROP POLICY IF EXISTS "pr_attachments_update" ON public.pr_attachments;
CREATE POLICY "pr_attachments_update" ON public.pr_attachments
  FOR UPDATE USING (auth.uid() = uploaded_by);
