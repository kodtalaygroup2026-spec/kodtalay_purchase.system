-- Migration 0035: ตำแหน่งผู้ดูแลงาน (position) แทนชื่อคน — 1 ตำแหน่งมีหลายสมาชิกได้
-- ต้องรันหลัง 0034 (categories ต้องมีคอลัมน์ code แล้ว)

-- ── ตำแหน่งผู้ดูแลงาน ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.approval_positions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  description text,
  is_active   boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- ── สมาชิกในตำแหน่ง (1 ตำแหน่ง = หลายคน) ────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.position_members (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  position_id uuid NOT NULL REFERENCES public.approval_positions(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (position_id, user_id)
);

-- ── categories: ผูกกับตำแหน่ง (แทน approver_hint ที่เป็นชื่อคน) ───────────────
ALTER TABLE public.categories
  ADD COLUMN IF NOT EXISTS position_id uuid REFERENCES public.approval_positions(id) ON DELETE SET NULL;

-- ── RLS: ทุกคนอ่านได้, แก้ได้เฉพาะ admin ────────────────────────────────────
ALTER TABLE public.approval_positions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.position_members    ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "positions_select" ON public.approval_positions;
CREATE POLICY "positions_select" ON public.approval_positions
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "positions_all" ON public.approval_positions;
CREATE POLICY "positions_all" ON public.approval_positions
  FOR ALL TO authenticated
  USING (current_user_role() = 'admin')
  WITH CHECK (current_user_role() = 'admin');

DROP POLICY IF EXISTS "position_members_select" ON public.position_members;
CREATE POLICY "position_members_select" ON public.position_members
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "position_members_all" ON public.position_members;
CREATE POLICY "position_members_all" ON public.position_members
  FOR ALL TO authenticated
  USING (current_user_role() = 'admin')
  WITH CHECK (current_user_role() = 'admin');

-- ── seed 5 ตำแหน่ง + ผูกกับหมวด ─────────────────────────────────────────────
WITH ins AS (
  INSERT INTO public.approval_positions (name) VALUES
    ('จัดซื้ออาหาร & ขนส่ง'),
    ('การตลาด'),
    ('จัดซื้อทั่วไป'),
    ('ฝ่ายบุคคล (HR)'),
    ('ช่าง & รับเหมา')
  RETURNING id, name
)
UPDATE public.categories c
SET position_id = ins.id
FROM ins
WHERE (ins.name = 'จัดซื้ออาหาร & ขนส่ง' AND c.code IN ('FOOD COST', 'DELIV'))
   OR (ins.name = 'การตลาด'             AND c.code = 'MKT')
   OR (ins.name = 'จัดซื้อทั่วไป'         AND c.code = 'SUPPLIES')
   OR (ins.name = 'ฝ่ายบุคคล (HR)'       AND c.code IN ('TEMP', 'TRANS & ACC', 'WELFARE'))
   OR (ins.name = 'ช่าง & รับเหมา'       AND c.code IN ('CONTRACT', 'FIX ASSET', 'REPAIR'));
