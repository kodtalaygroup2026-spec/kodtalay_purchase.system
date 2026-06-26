-- Migration 0005: PR Enhancements — is_urgent + second approval status
-- รันใน Supabase Dashboard > SQL Editor

ALTER TABLE purchase_requisitions
  ADD COLUMN IF NOT EXISTS is_urgent boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS actual_amount numeric(14,2);

ALTER TYPE pr_status ADD VALUE IF NOT EXISTS 'pending_second_approval';
ALTER TYPE pr_status ADD VALUE IF NOT EXISTS 'returned';
