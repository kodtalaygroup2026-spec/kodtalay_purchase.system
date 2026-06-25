-- ============================================================
-- Migration 0002: Expense Request Module + Branches
-- ใบเบิกค่าใช้จ่าย + ตารางสาขา
-- ============================================================

-- ------------------------------------------------------------
-- 1. branches (สาขา)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS branches (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  code       text        UNIQUE NOT NULL,   -- CK, BN, RCA
  name       text        NOT NULL,          -- KOD CK, KOD BN, KOD RCA GROUP
  is_active  boolean     NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER set_branches_updated_at
  BEFORE UPDATE ON branches
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE branches ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "branches_select" ON branches;
CREATE POLICY "branches_select" ON branches
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "branches_insert" ON branches;
CREATE POLICY "branches_insert" ON branches
  FOR INSERT TO authenticated
  WITH CHECK (current_user_role() = 'admin');

DROP POLICY IF EXISTS "branches_update" ON branches;
CREATE POLICY "branches_update" ON branches
  FOR UPDATE TO authenticated
  USING (current_user_role() = 'admin');

DROP POLICY IF EXISTS "branches_delete" ON branches;
CREATE POLICY "branches_delete" ON branches
  FOR DELETE TO authenticated
  USING (current_user_role() = 'admin');

-- Seed: 3 สาขาเริ่มต้น
INSERT INTO branches (code, name) VALUES
  ('CK',  'KOD CK'),
  ('BN',  'KOD BN'),
  ('RCA', 'KOD RCA GROUP')
ON CONFLICT (code) DO NOTHING;

-- ------------------------------------------------------------
-- 2. เพิ่ม branch_id ใน profiles
-- ------------------------------------------------------------
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS branch_id uuid REFERENCES branches(id) ON DELETE SET NULL;

-- ------------------------------------------------------------
-- 3. expense_status enum
-- ------------------------------------------------------------
DO $$ BEGIN
  CREATE TYPE expense_status AS ENUM (
    'draft', 'submitted', 'approved', 'rejected', 'paid', 'cancelled'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ------------------------------------------------------------
-- 4. expense_requests (ใบเบิก)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS expense_requests (
  id             uuid           PRIMARY KEY DEFAULT gen_random_uuid(),
  request_number text           UNIQUE NOT NULL,
  title          text           NOT NULL,
  requester_id   uuid           NOT NULL REFERENCES profiles(id),
  branch_id      uuid           NOT NULL REFERENCES branches(id),
  request_date   date           NOT NULL DEFAULT CURRENT_DATE,
  total_amount   numeric(14,2)  NOT NULL DEFAULT 0 CHECK (total_amount >= 0),
  status         expense_status NOT NULL DEFAULT 'draft',
  payment_date   date,
  note           text,
  created_at     timestamptz    NOT NULL DEFAULT now(),
  updated_at     timestamptz    NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_expense_status    ON expense_requests (status);
CREATE INDEX IF NOT EXISTS idx_expense_requester ON expense_requests (requester_id);
CREATE INDEX IF NOT EXISTS idx_expense_branch    ON expense_requests (branch_id);

CREATE TRIGGER set_expense_requests_updated_at
  BEFORE UPDATE ON expense_requests
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE expense_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "expense_requests_select" ON expense_requests;
CREATE POLICY "expense_requests_select" ON expense_requests
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "expense_requests_insert" ON expense_requests;
CREATE POLICY "expense_requests_insert" ON expense_requests
  FOR INSERT TO authenticated
  WITH CHECK (requester_id = auth.uid());

DROP POLICY IF EXISTS "expense_requests_update" ON expense_requests;
CREATE POLICY "expense_requests_update" ON expense_requests
  FOR UPDATE TO authenticated
  USING (
    requester_id = auth.uid()
    OR current_user_role() IN ('admin', 'manager')
  );

-- ------------------------------------------------------------
-- 5. expense_items (รายการในใบเบิก)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS expense_items (
  id          uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  expense_id  uuid          NOT NULL REFERENCES expense_requests(id) ON DELETE CASCADE,
  description text          NOT NULL,
  amount      numeric(14,2) NOT NULL DEFAULT 0 CHECK (amount >= 0),
  created_at  timestamptz   NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_expense_items_expense ON expense_items (expense_id);

ALTER TABLE expense_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "expense_items_select" ON expense_items;
CREATE POLICY "expense_items_select" ON expense_items
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "expense_items_insert" ON expense_items;
CREATE POLICY "expense_items_insert" ON expense_items
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM expense_requests er
      WHERE er.id = expense_id
        AND (er.requester_id = auth.uid() OR current_user_role() IN ('admin', 'manager'))
    )
  );

DROP POLICY IF EXISTS "expense_items_update" ON expense_items;
CREATE POLICY "expense_items_update" ON expense_items
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM expense_requests er
      WHERE er.id = expense_id
        AND (er.requester_id = auth.uid() OR current_user_role() IN ('admin', 'manager'))
    )
  );

DROP POLICY IF EXISTS "expense_items_delete" ON expense_items;
CREATE POLICY "expense_items_delete" ON expense_items
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM expense_requests er
      WHERE er.id = expense_id
        AND (er.requester_id = auth.uid() OR current_user_role() IN ('admin', 'manager'))
    )
  );

-- ------------------------------------------------------------
-- 6. Trigger: อัปเดต total_amount อัตโนมัติเมื่อ items เปลี่ยน
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION update_expense_total()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_expense_id uuid;
BEGIN
  v_expense_id := COALESCE(NEW.expense_id, OLD.expense_id);
  UPDATE expense_requests
  SET total_amount = COALESCE((
    SELECT SUM(amount) FROM expense_items WHERE expense_id = v_expense_id
  ), 0)
  WHERE id = v_expense_id;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_update_expense_total ON expense_items;
CREATE TRIGGER trg_update_expense_total
  AFTER INSERT OR UPDATE OR DELETE ON expense_items
  FOR EACH ROW EXECUTE FUNCTION update_expense_total();

-- ------------------------------------------------------------
-- 7. แก้ approvals ให้รองรับ document_type = 'expense'
-- ------------------------------------------------------------
ALTER TABLE approvals DROP CONSTRAINT IF EXISTS approvals_document_type_check;
ALTER TABLE approvals ADD CONSTRAINT approvals_document_type_check
  CHECK (document_type IN ('PR', 'PO', 'expense'));
