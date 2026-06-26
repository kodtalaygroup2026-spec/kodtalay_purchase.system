-- Migration 0006: Construction Module
-- รันใน Supabase Dashboard > SQL Editor

-- ตาราง ticket งานก่อสร้าง
CREATE TABLE IF NOT EXISTS construction_tickets (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_number text        NOT NULL UNIQUE,
  title         text        NOT NULL,
  location      text,
  description   text,
  requester_id  uuid        NOT NULL REFERENCES profiles(id),
  branch_id     uuid        REFERENCES branches(id),
  status        text        NOT NULL DEFAULT 'open'
                CHECK (status IN ('open','boq_pending','boq_approved','payment_pending','payment_approved','closed')),
  boq_total     numeric(14,2) NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

-- ตาราง BOQ รายการ
CREATE TABLE IF NOT EXISTS boq_items (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id   uuid        NOT NULL REFERENCES construction_tickets(id) ON DELETE CASCADE,
  description text        NOT NULL,
  unit        text        NOT NULL,
  quantity    numeric(12,3) NOT NULL DEFAULT 1,
  unit_price  numeric(14,2) NOT NULL DEFAULT 0,
  line_total  numeric(14,2) GENERATED ALWAYS AS (quantity * unit_price) STORED,
  sort_order  int         NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- ตาราง Variation Order
CREATE TABLE IF NOT EXISTS variation_orders (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id     uuid        NOT NULL REFERENCES construction_tickets(id) ON DELETE CASCADE,
  vo_number     text        NOT NULL,
  description   text        NOT NULL,
  amount_change numeric(14,2) NOT NULL,
  status        text        NOT NULL DEFAULT 'pending'
                CHECK (status IN ('pending','approved','rejected')),
  approved_by   uuid        REFERENCES profiles(id),
  approved_at   timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- ตาราง ขอเบิก / ตรวจรับ
CREATE TABLE IF NOT EXISTS construction_payment_requests (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  request_number text        NOT NULL UNIQUE,
  ticket_id      uuid        NOT NULL REFERENCES construction_tickets(id),
  amount         numeric(14,2) NOT NULL,
  requester_id   uuid        NOT NULL REFERENCES profiles(id),
  status         text        NOT NULL DEFAULT 'pending'
                 CHECK (status IN ('pending','inspected','approved','rejected')),
  note           text,
  inspector_id   uuid        REFERENCES profiles(id),
  inspected_at   timestamptz,
  approved_by    uuid        REFERENCES profiles(id),
  approved_at    timestamptz,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE construction_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE boq_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE variation_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE construction_payment_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth_all_tickets"   ON construction_tickets           FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all_boq"       ON boq_items                      FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all_vo"        ON variation_orders                FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all_payments"  ON construction_payment_requests   FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ฟังก์ชัน auto updated_at
CREATE OR REPLACE FUNCTION update_construction_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE TRIGGER trg_construction_tickets_updated_at
  BEFORE UPDATE ON construction_tickets
  FOR EACH ROW EXECUTE FUNCTION update_construction_updated_at();

CREATE TRIGGER trg_construction_payments_updated_at
  BEFORE UPDATE ON construction_payment_requests
  FOR EACH ROW EXECUTE FUNCTION update_construction_updated_at();
