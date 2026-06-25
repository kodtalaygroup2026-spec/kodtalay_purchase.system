-- ============================================================================
-- Migration: 0001_init.sql
-- ระบบ: kodtalay_purchase.system (Procurement / Purchase Order System)
-- เวอร์ชัน: 0.1.0
-- คำอธิบาย: สร้างสคีมาฐานข้อมูลเริ่มต้นทั้งหมด — ตาราง, enum, ดัชนี (index),
--           trigger, ฟังก์ชันออกเลขที่เอกสาร และ Row Level Security (RLS)
-- หมายเหตุ: รันบน Supabase (PostgreSQL) ได้ทันที (Dashboard > SQL Editor หรือ supabase db push)
--           ไฟล์นี้ idempotent — รันซ้ำได้โดยไม่ error
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 0) Extension ที่จำเป็น
-- ---------------------------------------------------------------------------
create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- 1) ENUM Types — ใช้ DO block เพื่อรองรับการรันซ้ำ (idempotent)
-- ---------------------------------------------------------------------------
do $$ begin
  create type user_role as enum (
    'admin', 'manager', 'purchaser', 'requester', 'viewer'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type pr_status as enum (
    'draft', 'submitted', 'approved', 'rejected', 'cancelled', 'converted'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type po_status as enum (
    'draft', 'pending_approval', 'approved', 'sent',
    'partially_received', 'received', 'closed', 'cancelled'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type approval_decision as enum ('pending', 'approved', 'rejected');
exception when duplicate_object then null;
end $$;

-- ---------------------------------------------------------------------------
-- 2) ฟังก์ชันช่วยเหลือ
-- ---------------------------------------------------------------------------
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- 3) ตาราง profiles
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  full_name   text not null default '',
  email       text not null,
  department  text,
  role        user_role not null default 'requester',
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

comment on table public.profiles is 'ข้อมูลโปรไฟล์ผู้ใช้ เชื่อมกับ auth.users';

create or replace function handle_new_user()
returns trigger language plpgsql
security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'full_name', ''))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

create or replace function current_user_role()
returns user_role language sql stable
security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid();
$$;

-- ---------------------------------------------------------------------------
-- 4) ตาราง suppliers
-- ---------------------------------------------------------------------------
create table if not exists public.suppliers (
  id            uuid primary key default gen_random_uuid(),
  code          text unique not null,
  name          text not null,
  tax_id        text,
  contact_name  text,
  phone         text,
  email         text,
  address       text,
  is_active     boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

comment on table public.suppliers is 'ข้อมูลผู้ขาย/คู่ค้า';
create index if not exists idx_suppliers_active on public.suppliers (is_active);

-- ---------------------------------------------------------------------------
-- 5) ตาราง categories & products
-- ---------------------------------------------------------------------------
create table if not exists public.categories (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  description text,
  created_at  timestamptz not null default now()
);

comment on table public.categories is 'หมวดหมู่สินค้า/บริการ';

create table if not exists public.products (
  id           uuid primary key default gen_random_uuid(),
  sku          text unique not null,
  name         text not null,
  category_id  uuid references public.categories (id) on delete set null,
  unit         text not null default 'ชิ้น',
  unit_price   numeric(14, 2) not null default 0 check (unit_price >= 0),
  is_active    boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

comment on table public.products is 'รายการสินค้า/บริการที่จัดซื้อได้';
create index if not exists idx_products_category on public.products (category_id);
create index if not exists idx_products_active on public.products (is_active);

-- ---------------------------------------------------------------------------
-- 6) ใบขอซื้อ (Purchase Requisition - PR) และรายการย่อย
-- ---------------------------------------------------------------------------
create table if not exists public.purchase_requisitions (
  id            uuid primary key default gen_random_uuid(),
  pr_number     text unique not null,
  title         text not null,
  status        pr_status not null default 'draft',
  requester_id  uuid not null references public.profiles (id),
  department    text,
  needed_by     date,
  note          text,
  total_amount  numeric(14, 2) not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

comment on table public.purchase_requisitions is 'ใบขอซื้อ (PR)';
create index if not exists idx_pr_status on public.purchase_requisitions (status);
create index if not exists idx_pr_requester on public.purchase_requisitions (requester_id);

create table if not exists public.pr_items (
  id          uuid primary key default gen_random_uuid(),
  pr_id       uuid not null references public.purchase_requisitions (id) on delete cascade,
  product_id  uuid references public.products (id) on delete set null,
  description text not null,
  quantity    numeric(14, 2) not null check (quantity > 0),
  unit        text not null default 'ชิ้น',
  unit_price  numeric(14, 2) not null default 0 check (unit_price >= 0),
  line_total  numeric(14, 2) generated always as (quantity * unit_price) stored,
  created_at  timestamptz not null default now()
);

comment on table public.pr_items is 'รายการย่อยในใบขอซื้อ';
create index if not exists idx_pr_items_pr on public.pr_items (pr_id);

-- ---------------------------------------------------------------------------
-- 7) ใบสั่งซื้อ (Purchase Order - PO) และรายการย่อย
-- ---------------------------------------------------------------------------
create table if not exists public.purchase_orders (
  id            uuid primary key default gen_random_uuid(),
  po_number     text unique not null,
  pr_id         uuid references public.purchase_requisitions (id) on delete set null,
  supplier_id   uuid not null references public.suppliers (id),
  status        po_status not null default 'draft',
  created_by    uuid not null references public.profiles (id),
  order_date    date not null default current_date,
  expected_date date,
  note          text,
  subtotal      numeric(14, 2) not null default 0,
  vat_rate      numeric(5, 2) not null default 7.00,
  vat_amount    numeric(14, 2) not null default 0,
  total_amount  numeric(14, 2) not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

comment on table public.purchase_orders is 'ใบสั่งซื้อ (PO)';
create index if not exists idx_po_status on public.purchase_orders (status);
create index if not exists idx_po_supplier on public.purchase_orders (supplier_id);
create index if not exists idx_po_pr on public.purchase_orders (pr_id);

create table if not exists public.po_items (
  id           uuid primary key default gen_random_uuid(),
  po_id        uuid not null references public.purchase_orders (id) on delete cascade,
  product_id   uuid references public.products (id) on delete set null,
  description  text not null,
  quantity     numeric(14, 2) not null check (quantity > 0),
  received_qty numeric(14, 2) not null default 0 check (received_qty >= 0),
  unit         text not null default 'ชิ้น',
  unit_price   numeric(14, 2) not null default 0 check (unit_price >= 0),
  line_total   numeric(14, 2) generated always as (quantity * unit_price) stored,
  created_at   timestamptz not null default now()
);

comment on table public.po_items is 'รายการย่อยในใบสั่งซื้อ';
create index if not exists idx_po_items_po on public.po_items (po_id);

-- ---------------------------------------------------------------------------
-- 8) การอนุมัติ (Approvals)
-- ---------------------------------------------------------------------------
create table if not exists public.approvals (
  id            uuid primary key default gen_random_uuid(),
  document_type text not null check (document_type in ('PR', 'PO')),
  document_id   uuid not null,
  approver_id   uuid not null references public.profiles (id),
  step          integer not null default 1,
  decision      approval_decision not null default 'pending',
  comment       text,
  decided_at    timestamptz,
  created_at    timestamptz not null default now()
);

comment on table public.approvals is 'บันทึกการอนุมัติเอกสาร (รองรับหลายขั้น)';
create index if not exists idx_approvals_document on public.approvals (document_type, document_id);
create index if not exists idx_approvals_approver on public.approvals (approver_id);

-- ---------------------------------------------------------------------------
-- 9) การรับของ (Goods Receipt - GR) และรายการย่อย
--    หมายเหตุ: ใช้ received_date (date column) ไม่ใช่ received_at
-- ---------------------------------------------------------------------------
create table if not exists public.goods_receipts (
  id            uuid primary key default gen_random_uuid(),
  gr_number     text unique not null,
  po_id         uuid not null references public.purchase_orders (id),
  received_by   uuid not null references public.profiles (id),
  received_date date not null default current_date,
  note          text,
  created_at    timestamptz not null default now()
);

comment on table public.goods_receipts is 'ใบรับของ (GR)';
create index if not exists idx_gr_po on public.goods_receipts (po_id);

create table if not exists public.gr_items (
  id          uuid primary key default gen_random_uuid(),
  gr_id       uuid not null references public.goods_receipts (id) on delete cascade,
  po_item_id  uuid not null references public.po_items (id),
  quantity    numeric(14, 2) not null check (quantity > 0),
  created_at  timestamptz not null default now()
);

comment on table public.gr_items is 'รายการย่อยในใบรับของ';
create index if not exists idx_gr_items_gr on public.gr_items (gr_id);

-- ---------------------------------------------------------------------------
-- 10) Audit log
-- ---------------------------------------------------------------------------
create table if not exists public.audit_logs (
  id          bigint generated always as identity primary key,
  actor_id    uuid references public.profiles (id),
  action      text not null,
  entity      text not null,
  entity_id   uuid,
  metadata    jsonb,
  created_at  timestamptz not null default now()
);

comment on table public.audit_logs is 'บันทึกประวัติการกระทำเพื่อการตรวจสอบ';
create index if not exists idx_audit_entity on public.audit_logs (entity, entity_id);

-- ---------------------------------------------------------------------------
-- 11) Triggers สำหรับ updated_at (DROP IF EXISTS ก่อนเสมอ)
-- ---------------------------------------------------------------------------
drop trigger if exists trg_profiles_updated  on public.profiles;
drop trigger if exists trg_suppliers_updated on public.suppliers;
drop trigger if exists trg_products_updated  on public.products;
drop trigger if exists trg_pr_updated        on public.purchase_requisitions;
drop trigger if exists trg_po_updated        on public.purchase_orders;

create trigger trg_profiles_updated  before update on public.profiles            for each row execute function set_updated_at();
create trigger trg_suppliers_updated before update on public.suppliers           for each row execute function set_updated_at();
create trigger trg_products_updated  before update on public.products            for each row execute function set_updated_at();
create trigger trg_pr_updated        before update on public.purchase_requisitions for each row execute function set_updated_at();
create trigger trg_po_updated        before update on public.purchase_orders     for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- 12) ฟังก์ชันออกเลขที่เอกสารอัตโนมัติ
-- ---------------------------------------------------------------------------
create or replace function next_document_number(prefix text, table_name text, column_name text)
returns text language plpgsql
security definer set search_path = public as $$
declare
  yyyymm    text := to_char(now(), 'YYYYMM');
  pattern   text := prefix || '-' || yyyymm || '-%';
  max_seq   integer;
  next_seq  integer;
begin
  perform pg_advisory_xact_lock(hashtext(prefix || yyyymm));

  execute format(
    'select coalesce(max(split_part(%I, ''-'', 3)::integer), 0) from %I where %I like $1',
    column_name, table_name, column_name
  ) into max_seq using pattern;

  next_seq := max_seq + 1;
  return prefix || '-' || yyyymm || '-' || lpad(next_seq::text, 4, '0');
end;
$$;

-- ============================================================================
-- 13) Row Level Security (RLS)
-- ============================================================================
alter table public.profiles               enable row level security;
alter table public.suppliers              enable row level security;
alter table public.categories             enable row level security;
alter table public.products               enable row level security;
alter table public.purchase_requisitions  enable row level security;
alter table public.pr_items               enable row level security;
alter table public.purchase_orders        enable row level security;
alter table public.po_items               enable row level security;
alter table public.approvals              enable row level security;
alter table public.goods_receipts         enable row level security;
alter table public.gr_items               enable row level security;
alter table public.audit_logs             enable row level security;

-- profiles
drop policy if exists "profiles_select" on public.profiles;
drop policy if exists "profiles_update_self_or_admin" on public.profiles;
create policy "profiles_select" on public.profiles
  for select to authenticated using (true);
create policy "profiles_update_self_or_admin" on public.profiles
  for update to authenticated
  using (id = auth.uid() or current_user_role() = 'admin')
  with check (id = auth.uid() or current_user_role() = 'admin');

-- suppliers
drop policy if exists "suppliers_select" on public.suppliers;
drop policy if exists "suppliers_write" on public.suppliers;
create policy "suppliers_select"  on public.suppliers  for select to authenticated using (true);
create policy "suppliers_write"   on public.suppliers  for all    to authenticated
  using (current_user_role() in ('admin', 'purchaser'))
  with check (current_user_role() in ('admin', 'purchaser'));

-- categories
drop policy if exists "categories_select" on public.categories;
drop policy if exists "categories_write" on public.categories;
create policy "categories_select" on public.categories for select to authenticated using (true);
create policy "categories_write"  on public.categories for all    to authenticated
  using (current_user_role() in ('admin', 'purchaser'))
  with check (current_user_role() in ('admin', 'purchaser'));

-- products
drop policy if exists "products_select" on public.products;
drop policy if exists "products_write" on public.products;
create policy "products_select"   on public.products   for select to authenticated using (true);
create policy "products_write"    on public.products   for all    to authenticated
  using (current_user_role() in ('admin', 'purchaser'))
  with check (current_user_role() in ('admin', 'purchaser'));

-- purchase_requisitions
drop policy if exists "pr_select" on public.purchase_requisitions;
drop policy if exists "pr_insert" on public.purchase_requisitions;
drop policy if exists "pr_update" on public.purchase_requisitions;
create policy "pr_select" on public.purchase_requisitions
  for select to authenticated using (true);
create policy "pr_insert" on public.purchase_requisitions
  for insert to authenticated with check (requester_id = auth.uid());
create policy "pr_update" on public.purchase_requisitions
  for update to authenticated
  using (requester_id = auth.uid() or current_user_role() in ('admin', 'manager'))
  with check (requester_id = auth.uid() or current_user_role() in ('admin', 'manager'));

-- pr_items
drop policy if exists "pr_items_select" on public.pr_items;
drop policy if exists "pr_items_write" on public.pr_items;
create policy "pr_items_select" on public.pr_items
  for select to authenticated using (true);
create policy "pr_items_write" on public.pr_items
  for all to authenticated
  using (exists (
    select 1 from public.purchase_requisitions pr
    where pr.id = pr_items.pr_id
      and (pr.requester_id = auth.uid() or current_user_role() in ('admin', 'manager'))
  ))
  with check (exists (
    select 1 from public.purchase_requisitions pr
    where pr.id = pr_items.pr_id
      and (pr.requester_id = auth.uid() or current_user_role() in ('admin', 'manager'))
  ));

-- purchase_orders
drop policy if exists "po_select" on public.purchase_orders;
drop policy if exists "po_write" on public.purchase_orders;
create policy "po_select" on public.purchase_orders for select to authenticated using (true);
create policy "po_write"  on public.purchase_orders for all to authenticated
  using (current_user_role() in ('admin', 'purchaser'))
  with check (current_user_role() in ('admin', 'purchaser'));

-- po_items
drop policy if exists "po_items_select" on public.po_items;
drop policy if exists "po_items_write" on public.po_items;
create policy "po_items_select" on public.po_items for select to authenticated using (true);
create policy "po_items_write"  on public.po_items for all to authenticated
  using (current_user_role() in ('admin', 'purchaser'))
  with check (current_user_role() in ('admin', 'purchaser'));

-- approvals
drop policy if exists "approvals_select" on public.approvals;
drop policy if exists "approvals_write" on public.approvals;
create policy "approvals_select" on public.approvals for select to authenticated using (true);
create policy "approvals_write"  on public.approvals for all to authenticated
  using (approver_id = auth.uid() or current_user_role() in ('admin', 'manager'))
  with check (approver_id = auth.uid() or current_user_role() in ('admin', 'manager'));

-- goods_receipts
drop policy if exists "gr_select" on public.goods_receipts;
drop policy if exists "gr_write" on public.goods_receipts;
create policy "gr_select" on public.goods_receipts for select to authenticated using (true);
create policy "gr_write"  on public.goods_receipts for all to authenticated
  using (current_user_role() in ('admin', 'purchaser'))
  with check (current_user_role() in ('admin', 'purchaser'));

-- gr_items
drop policy if exists "gr_items_select" on public.gr_items;
drop policy if exists "gr_items_write" on public.gr_items;
create policy "gr_items_select" on public.gr_items for select to authenticated using (true);
create policy "gr_items_write"  on public.gr_items for all to authenticated
  using (current_user_role() in ('admin', 'purchaser'))
  with check (current_user_role() in ('admin', 'purchaser'));

-- audit_logs
drop policy if exists "audit_select_admin" on public.audit_logs;
create policy "audit_select_admin" on public.audit_logs
  for select to authenticated using (current_user_role() in ('admin', 'manager'));

-- ============================================================================
-- จบ migration 0001
-- ============================================================================
