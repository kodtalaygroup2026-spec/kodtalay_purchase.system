-- Migration 0017: สร้างตาราง payment_evidences และ evidence_files
-- ใช้บันทึกหลักฐานรับของ + ข้อมูลผู้รับเงิน หลังจาก PO ได้รับการอนุมัติ

-- ── ตารางหลัก: ข้อมูลผู้รับเงิน + สถานะการส่งหลักฐาน ────────────────────
CREATE TABLE IF NOT EXISTS public.payment_evidences (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  po_id                uuid NOT NULL REFERENCES public.purchase_orders(id) ON DELETE CASCADE,
  pr_id                uuid NOT NULL REFERENCES public.purchase_requisitions(id) ON DELETE CASCADE,
  account_holder_name  text NOT NULL,          -- ชื่อเจ้าของบัญชี
  bank_name            text,                   -- รหัสธนาคาร เช่น KBANK, SCB
  bank_account_number  text,                   -- เลขที่บัญชี
  notes                text,
  submitted_at         timestamptz NOT NULL DEFAULT now(),
  submitted_by         uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at           timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.payment_evidences IS 'ข้อมูลผู้รับเงินและหลักฐานการรับของ ส่งโดย requester หลัง PO อนุมัติ';

CREATE INDEX IF NOT EXISTS idx_payment_evidences_po ON public.payment_evidences(po_id);
CREATE INDEX IF NOT EXISTS idx_payment_evidences_pr ON public.payment_evidences(pr_id);

ALTER TABLE public.payment_evidences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "payment_evidences_select" ON public.payment_evidences
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "payment_evidences_insert" ON public.payment_evidences
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = submitted_by);

CREATE POLICY "payment_evidences_update" ON public.payment_evidences
  FOR UPDATE TO authenticated
  USING (auth.uid() = submitted_by OR EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'manager', 'finance')
  ));

-- ── ตารางไฟล์แนบ: บิล / สลิป / รูปรับของ ────────────────────────────────
CREATE TABLE IF NOT EXISTS public.evidence_files (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  evidence_id   uuid NOT NULL REFERENCES public.payment_evidences(id) ON DELETE CASCADE,
  file_name     text NOT NULL,
  file_url      text NOT NULL,
  evidence_type text NOT NULL CHECK (evidence_type IN ('bill', 'slip', 'goods_receipt', 'other')),
  file_size     integer,
  uploaded_by   uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at    timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.evidence_files IS 'ไฟล์แนบหลักฐาน แยกตามประเภท: bill, slip, goods_receipt';

CREATE INDEX IF NOT EXISTS idx_evidence_files_evidence ON public.evidence_files(evidence_id);

ALTER TABLE public.evidence_files ENABLE ROW LEVEL SECURITY;

CREATE POLICY "evidence_files_select" ON public.evidence_files
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "evidence_files_insert" ON public.evidence_files
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = uploaded_by);

-- ── Storage bucket: evidence-attachments (public) ──────────────────────────
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'evidence-attachments',
  'evidence-attachments',
  true,
  10485760,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
)
ON CONFLICT (id) DO UPDATE SET public = true, file_size_limit = 10485760;

DROP POLICY IF EXISTS "evidence_storage_select" ON storage.objects;
CREATE POLICY "evidence_storage_select" ON storage.objects
  FOR SELECT USING (bucket_id = 'evidence-attachments' AND auth.role() = 'authenticated');

DROP POLICY IF EXISTS "evidence_storage_insert" ON storage.objects;
CREATE POLICY "evidence_storage_insert" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'evidence-attachments' AND auth.role() = 'authenticated');

DROP POLICY IF EXISTS "evidence_storage_delete" ON storage.objects;
CREATE POLICY "evidence_storage_delete" ON storage.objects
  FOR DELETE USING (bucket_id = 'evidence-attachments' AND auth.role() = 'authenticated');
