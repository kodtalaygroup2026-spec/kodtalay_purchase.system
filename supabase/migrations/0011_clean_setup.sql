-- ============================================================
-- Migration 0011: Clean Setup (Idempotent)
-- รวมทุก migration ที่จำเป็น รันซ้ำได้ปลอดภัย
-- รัน: Supabase Dashboard → SQL Editor → วางทั้งหมดแล้วกด Run
-- ============================================================

-- ============================================================
-- A. ENUM VALUES
-- ============================================================

-- เพิ่ม role 'finance' ถ้ายังไม่มี
DO $$ BEGIN
  ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'finance';
EXCEPTION WHEN others THEN NULL;
END $$;

-- เพิ่ม pr_status ใหม่
DO $$ BEGIN
  ALTER TYPE pr_status ADD VALUE IF NOT EXISTS 'pending_second_approval';
EXCEPTION WHEN others THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TYPE pr_status ADD VALUE IF NOT EXISTS 'returned';
EXCEPTION WHEN others THEN NULL;
END $$;

-- ============================================================
-- B. ตาราง BRANCHES (สาขา/บริษัท)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.branches (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  code       text        UNIQUE NOT NULL,
  name       text        NOT NULL,
  is_active  boolean     NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Trigger updated_at
DROP TRIGGER IF EXISTS set_branches_updated_at ON public.branches;
CREATE TRIGGER set_branches_updated_at
  BEFORE UPDATE ON public.branches
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- RLS
ALTER TABLE public.branches ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "branches_select" ON public.branches;
CREATE POLICY "branches_select" ON public.branches
  FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "branches_manage" ON public.branches;
CREATE POLICY "branches_manage" ON public.branches
  FOR ALL TO authenticated
  USING (current_user_role() = 'admin')
  WITH CHECK (current_user_role() = 'admin');

-- Seed บริษัทเริ่มต้น
INSERT INTO public.branches (code, name) VALUES
  ('CK',  'KOD CK'),
  ('BN',  'KOD BN'),
  ('RCA', 'KOD RCA GROUP')
ON CONFLICT (code) DO NOTHING;

-- ============================================================
-- C. เพิ่ม COLUMNS ที่ขาดใน PROFILES
-- ============================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS branch_id     uuid REFERENCES public.branches(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS line_user_id  text;

-- ============================================================
-- D. ตาราง LINE LINK CODES (OTP เชื่อม LINE)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.line_link_codes (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  code       text        NOT NULL UNIQUE,
  user_id    uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '10 minutes'),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_line_link_codes_expires ON public.line_link_codes(expires_at);
ALTER TABLE public.line_link_codes ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- E. เพิ่ม COLUMNS ที่ขาดใน PURCHASE_REQUISITIONS
-- ============================================================

ALTER TABLE public.purchase_requisitions
  ADD COLUMN IF NOT EXISTS branch_id           uuid        REFERENCES public.branches(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS is_urgent           boolean     NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS actual_amount       numeric(14,2),
  ADD COLUMN IF NOT EXISTS bank_name           text,
  ADD COLUMN IF NOT EXISTS bank_account_number text,
  ADD COLUMN IF NOT EXISTS submitted_at        timestamptz,
  ADD COLUMN IF NOT EXISTS submitted_by        uuid        REFERENCES public.profiles(id),
  ADD COLUMN IF NOT EXISTS approved_at         timestamptz,
  ADD COLUMN IF NOT EXISTS approved_by         uuid        REFERENCES public.profiles(id),
  ADD COLUMN IF NOT EXISTS rejected_at         timestamptz,
  ADD COLUMN IF NOT EXISTS rejected_by         uuid        REFERENCES public.profiles(id),
  ADD COLUMN IF NOT EXISTS cancelled_at        timestamptz,
  ADD COLUMN IF NOT EXISTS cancelled_by        uuid        REFERENCES public.profiles(id);

-- เปลี่ยน needed_by จาก date → timestamptz
DO $$
DECLARE col_type text;
BEGIN
  SELECT data_type INTO col_type
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name   = 'purchase_requisitions'
    AND column_name  = 'needed_by';
  IF col_type = 'date' THEN
    ALTER TABLE public.purchase_requisitions
      ALTER COLUMN needed_by TYPE timestamptz USING needed_by::timestamptz;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_pr_branch ON public.purchase_requisitions (branch_id);

-- ============================================================
-- F. เพิ่ม LINE_NO ใน PR_ITEMS
-- ============================================================

ALTER TABLE public.pr_items
  ADD COLUMN IF NOT EXISTS line_no integer;

-- ============================================================
-- G. เพิ่ม AUDIT COLUMNS ใน PURCHASE_ORDERS
-- ============================================================

ALTER TABLE public.purchase_orders
  ADD COLUMN IF NOT EXISTS approved_at  timestamptz,
  ADD COLUMN IF NOT EXISTS approved_by  uuid REFERENCES public.profiles(id),
  ADD COLUMN IF NOT EXISTS cancelled_at timestamptz,
  ADD COLUMN IF NOT EXISTS cancelled_by uuid REFERENCES public.profiles(id);

-- ============================================================
-- H. ตาราง CONSTRUCTION MODULE
-- ============================================================

CREATE TABLE IF NOT EXISTS public.construction_tickets (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_number text        NOT NULL UNIQUE,
  title         text        NOT NULL,
  location      text,
  description   text,
  requester_id  uuid        NOT NULL REFERENCES public.profiles(id),
  branch_id     uuid        REFERENCES public.branches(id),
  status        text        NOT NULL DEFAULT 'open'
                CHECK (status IN ('open','boq_pending','boq_approved','payment_pending','payment_approved','closed')),
  boq_total     numeric(14,2) NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.boq_items (
  id          uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id   uuid          NOT NULL REFERENCES public.construction_tickets(id) ON DELETE CASCADE,
  description text          NOT NULL,
  unit        text          NOT NULL,
  quantity    numeric(12,3) NOT NULL DEFAULT 1,
  unit_price  numeric(14,2) NOT NULL DEFAULT 0,
  line_total  numeric(14,2) GENERATED ALWAYS AS (quantity * unit_price) STORED,
  sort_order  int           NOT NULL DEFAULT 0,
  created_at  timestamptz   NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.variation_orders (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id     uuid        NOT NULL REFERENCES public.construction_tickets(id) ON DELETE CASCADE,
  vo_number     text        NOT NULL,
  description   text        NOT NULL,
  amount_change numeric(14,2) NOT NULL,
  status        text        NOT NULL DEFAULT 'pending'
                CHECK (status IN ('pending','approved','rejected')),
  approved_by   uuid        REFERENCES public.profiles(id),
  approved_at   timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.construction_payment_requests (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  request_number text        NOT NULL UNIQUE,
  ticket_id      uuid        NOT NULL REFERENCES public.construction_tickets(id),
  amount         numeric(14,2) NOT NULL,
  requester_id   uuid        NOT NULL REFERENCES public.profiles(id),
  status         text        NOT NULL DEFAULT 'pending'
                 CHECK (status IN ('pending','inspected','approved','rejected')),
  note           text,
  inspector_id   uuid        REFERENCES public.profiles(id),
  inspected_at   timestamptz,
  approved_by    uuid        REFERENCES public.profiles(id),
  approved_at    timestamptz,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

-- RLS construction tables
ALTER TABLE public.construction_tickets            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.boq_items                       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.variation_orders                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.construction_payment_requests   ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "auth_all_tickets"   ON public.construction_tickets;
DROP POLICY IF EXISTS "auth_all_boq"       ON public.boq_items;
DROP POLICY IF EXISTS "auth_all_vo"        ON public.variation_orders;
DROP POLICY IF EXISTS "auth_all_payments"  ON public.construction_payment_requests;

CREATE POLICY "auth_all_tickets"   ON public.construction_tickets          FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all_boq"       ON public.boq_items                     FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all_vo"        ON public.variation_orders              FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all_payments"  ON public.construction_payment_requests FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Trigger updated_at construction
CREATE OR REPLACE FUNCTION update_construction_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS trg_construction_tickets_updated_at  ON public.construction_tickets;
DROP TRIGGER IF EXISTS trg_construction_payments_updated_at ON public.construction_payment_requests;
CREATE TRIGGER trg_construction_tickets_updated_at
  BEFORE UPDATE ON public.construction_tickets
  FOR EACH ROW EXECUTE FUNCTION update_construction_updated_at();
CREATE TRIGGER trg_construction_payments_updated_at
  BEFORE UPDATE ON public.construction_payment_requests
  FOR EACH ROW EXECUTE FUNCTION update_construction_updated_at();

-- ============================================================
-- I. ตาราง PR_ATTACHMENTS (ไฟล์แนบ)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.pr_attachments (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  pr_id       uuid        NOT NULL REFERENCES public.purchase_requisitions(id) ON DELETE CASCADE,
  file_name   text        NOT NULL,
  file_url    text        NOT NULL,
  file_type   text        NOT NULL CHECK (file_type IN ('image','pdf')),
  file_size   integer,
  uploaded_by uuid        REFERENCES public.profiles(id),
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pr_attachments_pr ON public.pr_attachments(pr_id);
ALTER TABLE public.pr_attachments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "pr_attachments_select" ON public.pr_attachments;
DROP POLICY IF EXISTS "pr_attachments_insert" ON public.pr_attachments;
CREATE POLICY "pr_attachments_select" ON public.pr_attachments
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "pr_attachments_insert" ON public.pr_attachments
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = uploaded_by);

-- ============================================================
-- J. อัปเดต HANDLE_NEW_USER TRIGGER
--    คนแรก = admin, คนต่อไป = requester
-- ============================================================

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public AS $$
DECLARE
  profile_count int;
  assigned_role user_role;
BEGIN
  SELECT COUNT(*) INTO profile_count FROM public.profiles;
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

-- ============================================================
-- K. Helper function สำหรับ branch isolation
-- ============================================================

CREATE OR REPLACE FUNCTION current_user_branch_id()
RETURNS uuid LANGUAGE sql STABLE
SECURITY DEFINER SET search_path = public AS $$
  SELECT branch_id FROM public.profiles WHERE id = auth.uid();
$$;

-- ============================================================
-- หมายเหตุ: หลังรัน SQL นี้สำเร็จ
--   1. ไปที่ Settings → API → กด "Reload schema"
--   2. สร้าง Storage bucket ชื่อ "pr-attachments" (Public: OFF)
-- ============================================================
