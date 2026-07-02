-- ============================================================
-- 0027: เพิ่มสิทธิ์ finance role ให้สามารถอัปเดต PR และ purchase_bills ได้
-- เหตุผล: DisbursementItem และ KTBTransferForm อัปเดต PR status='paid'
--         แต่ pr_update policy ไม่มี 'finance' → ล้มเหลวเงียบๆ
-- ============================================================

-- ── purchase_requisitions: pr_update ──────────────────────────────────────────
DROP POLICY IF EXISTS "pr_update" ON public.purchase_requisitions;
CREATE POLICY "pr_update" ON public.purchase_requisitions
  FOR UPDATE TO authenticated
  USING (
    requester_id = auth.uid()
    OR current_user_role() IN ('admin', 'manager', 'finance')
  )
  WITH CHECK (
    requester_id = auth.uid()
    OR current_user_role() IN ('admin', 'manager', 'finance')
  );

-- ── purchase_bills: update ────────────────────────────────────────────────────
DROP POLICY IF EXISTS "purchase_bills_update" ON public.purchase_bills;
CREATE POLICY "purchase_bills_update" ON public.purchase_bills
  FOR UPDATE TO authenticated
  USING (
    auth.uid() = created_by
    OR current_user_role() IN ('admin', 'manager', 'finance')
  )
  WITH CHECK (
    auth.uid() = created_by
    OR current_user_role() IN ('admin', 'manager', 'finance')
  );

-- ── purchase_bills: delete ────────────────────────────────────────────────────
DROP POLICY IF EXISTS "purchase_bills_delete" ON public.purchase_bills;
CREATE POLICY "purchase_bills_delete" ON public.purchase_bills
  FOR DELETE TO authenticated
  USING (
    current_user_role() IN ('admin', 'manager', 'finance')
  );
