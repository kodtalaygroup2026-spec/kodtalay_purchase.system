-- Migration 0026: เปิด INSERT บน audit_logs ให้ authenticated users ทำได้
-- ปัจจุบัน audit_logs มีแค่ SELECT policy → ไม่มีใครเขียน log ได้เลย

-- เพิ่ม INSERT policy: บันทึกได้เฉพาะในนาม actor_id ของตัวเอง
CREATE POLICY "audit_insert" ON public.audit_logs
  FOR INSERT TO authenticated
  WITH CHECK (actor_id = auth.uid());

-- อัปเดต SELECT: เปิดให้ finance ดูด้วย (ปัจจุบันเห็นแค่ admin/manager)
DROP POLICY IF EXISTS "audit_select_admin" ON public.audit_logs;
CREATE POLICY "audit_select" ON public.audit_logs
  FOR SELECT TO authenticated
  USING (current_user_role() IN ('admin', 'manager', 'finance'));
