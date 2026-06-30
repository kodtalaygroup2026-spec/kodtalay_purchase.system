-- Migration 0016: สร้างตาราง purchase_bills สำหรับบันทึกบิล/ใบแจ้งหนี้แยกต่างหาก

CREATE TABLE IF NOT EXISTS public.purchase_bills (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  po_id         uuid NOT NULL REFERENCES public.purchase_orders(id) ON DELETE CASCADE,
  bill_number   text,                             -- เลขที่บิลจากร้านค้า (optional)
  bill_date     date NOT NULL DEFAULT CURRENT_DATE,
  bill_amount   numeric(14, 2) NOT NULL,          -- ยอดในบิล (= PO total_amount)
  vendor_name   text,                             -- ร้านค้า (copy จาก PO)
  notes         text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  created_by    uuid REFERENCES public.profiles(id) ON DELETE SET NULL
);

COMMENT ON TABLE public.purchase_bills IS 'บิล/ใบแจ้งหนี้จากร้านค้า ผูกกับ PO แต่บันทึกแยกเพื่อดึงรายงานได้';

CREATE INDEX IF NOT EXISTS idx_purchase_bills_po ON public.purchase_bills(po_id);
CREATE INDEX IF NOT EXISTS idx_purchase_bills_date ON public.purchase_bills(bill_date);

ALTER TABLE public.purchase_bills ENABLE ROW LEVEL SECURITY;

CREATE POLICY "purchase_bills_select" ON public.purchase_bills
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "purchase_bills_insert" ON public.purchase_bills
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);

CREATE POLICY "purchase_bills_update" ON public.purchase_bills
  FOR UPDATE TO authenticated
  USING (auth.uid() = created_by OR EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'manager', 'purchaser')
  ));

CREATE POLICY "purchase_bills_delete" ON public.purchase_bills
  FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'manager')
  ));
