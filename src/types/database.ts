// ===========================================================================
// File: src/types/database.ts
// คำอธิบาย: TypeScript types ของสคีมาฐานข้อมูล (สอดคล้องกับ migration 0001)
// หมายเหตุ: เมื่อ schema เริ่มนิ่ง แนะนำให้ generate อัตโนมัติด้วยคำสั่ง:
//          npx supabase gen types typescript --project-id <ref> > src/types/database.ts
// ===========================================================================

export type UserRole = "admin" | "manager" | "purchaser" | "requester" | "viewer" | "finance";

export type PrStatus =
  | "draft"
  | "submitted"
  | "approved"
  | "rejected"
  | "cancelled"
  | "converted"
  | "pending_second_approval"
  | "returned";

export type ConstructionStatus =
  | "open"
  | "boq_pending"
  | "boq_approved"
  | "payment_pending"
  | "payment_approved"
  | "closed";

export type VOStatus = "pending" | "approved" | "rejected";

export type PaymentRequestStatus = "pending" | "inspected" | "approved" | "rejected";

export type PoStatus =
  | "draft"
  | "pending_approval"
  | "approved"
  | "sent"
  | "partially_received"
  | "received"
  | "closed"
  | "cancelled";

export type ApprovalDecision = "pending" | "approved" | "rejected";

export type ExpenseStatus =
  | "draft"
  | "submitted"
  | "approved"
  | "rejected"
  | "paid"
  | "cancelled";

export interface Branch {
  id: string;
  code: string;
  name: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Profile {
  id: string;
  full_name: string;
  email: string;
  department: string | null;
  branch_id: string | null;
  role: UserRole;
  line_user_id: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ExpenseRequest {
  id: string;
  request_number: string;
  title: string;
  requester_id: string;
  branch_id: string;
  request_date: string;
  total_amount: number;
  status: ExpenseStatus;
  payment_date: string | null;
  note: string | null;
  created_at: string;
  updated_at: string;
}

export interface ExpenseItem {
  id: string;
  expense_id: string;
  description: string;
  amount: number;
  created_at: string;
}

export interface Supplier {
  id: string;
  code: string;
  name: string;
  tax_id: string | null;
  contact_name: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Category {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
}

export interface Product {
  id: string;
  sku: string;
  name: string;
  category_id: string | null;
  unit: string;
  unit_price: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface PurchaseRequisition {
  id: string;
  pr_number: string;
  title: string;
  status: PrStatus;
  requester_id: string;
  department: string | null;
  needed_by: string | null;
  note: string | null;
  total_amount: number;
  is_urgent: boolean;
  actual_amount: number | null;
  created_at: string;
  updated_at: string;
}

export interface ConstructionTicket {
  id: string;
  ticket_number: string;
  title: string;
  location: string | null;
  description: string | null;
  requester_id: string;
  branch_id: string | null;
  status: ConstructionStatus;
  boq_total: number;
  created_at: string;
  updated_at: string;
}

export interface BOQItem {
  id: string;
  ticket_id: string;
  description: string;
  unit: string;
  quantity: number;
  unit_price: number;
  line_total: number;
  sort_order: number;
  created_at: string;
}

export interface VariationOrder {
  id: string;
  ticket_id: string;
  vo_number: string;
  description: string;
  amount_change: number;
  status: VOStatus;
  approved_by: string | null;
  approved_at: string | null;
  created_at: string;
}

export interface ConstructionPaymentRequest {
  id: string;
  request_number: string;
  ticket_id: string;
  amount: number;
  requester_id: string;
  status: PaymentRequestStatus;
  note: string | null;
  inspector_id: string | null;
  inspected_at: string | null;
  approved_by: string | null;
  approved_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface PRItem {
  id: string;
  pr_id: string;
  line_no: number;
  product_id: string | null;
  description: string;
  quantity: number;
  unit: string;
  unit_price: number;
  line_total: number;
  created_at: string;
}

export interface PurchaseOrder {
  id: string;
  po_number: string;
  pr_id: string | null;
  supplier_id: string;
  status: PoStatus;
  created_by: string;
  order_date: string;
  expected_date: string | null;
  note: string | null;
  subtotal: number;
  vat_rate: number;
  vat_amount: number;
  total_amount: number;
  created_at: string;
  updated_at: string;
}

export interface POItem {
  id: string;
  po_id: string;
  pr_item_id: string | null;
  line_no: number;
  product_id: string | null;
  description: string;
  quantity: number;
  unit: string;
  unit_price: number;
  line_total: number;
  received_qty: number;
  created_at: string;
}

export interface Approval {
  id: string;
  reference_type: "PR" | "PO";
  reference_id: string;
  step: number;
  approver_id: string;
  decision: ApprovalDecision;
  note: string | null;
  decided_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface GoodsReceipt {
  id: string;
  gr_number: string;
  po_id: string;
  received_by: string;
  received_date: string;
  note: string | null;
  created_at: string;
  updated_at: string;
}

export interface GRItem {
  id: string;
  gr_id: string;
  po_item_id: string;
  received_qty: number;
  note: string | null;
  created_at: string;
}

export interface LineLinkCode {
  id: string;
  code: string;
  user_id: string;
  expires_at: string;
  created_at: string;
}

// ---------------------------------------------------------------------------
// Database schema สำหรับ supabase-js typed client
// ---------------------------------------------------------------------------
export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: Profile;
        Insert: Partial<Profile> & Pick<Profile, "id" | "email">;
        Update: Partial<Profile>;
      };
      line_link_codes: {
        Row: LineLinkCode;
        Insert: Pick<LineLinkCode, "code" | "user_id">;
        Update: Partial<LineLinkCode>;
      };
      suppliers: {
        Row: Supplier;
        Insert: Partial<Supplier> & Pick<Supplier, "code" | "name">;
        Update: Partial<Supplier>;
      };
      categories: {
        Row: Category;
        Insert: Partial<Category> & Pick<Category, "name">;
        Update: Partial<Category>;
      };
      products: {
        Row: Product;
        Insert: Partial<Product> & Pick<Product, "sku" | "name" | "unit" | "unit_price">;
        Update: Partial<Product>;
      };
      purchase_requisitions: {
        Row: PurchaseRequisition;
        Insert: Partial<PurchaseRequisition> &
          Pick<PurchaseRequisition, "pr_number" | "title" | "requester_id">;
        Update: Partial<PurchaseRequisition>;
      };
      pr_items: {
        Row: PRItem;
        Insert: Partial<PRItem> &
          Pick<PRItem, "pr_id" | "line_no" | "description" | "quantity" | "unit" | "unit_price">;
        Update: Partial<PRItem>;
      };
      purchase_orders: {
        Row: PurchaseOrder;
        Insert: Partial<PurchaseOrder> &
          Pick<PurchaseOrder, "po_number" | "supplier_id" | "created_by" | "order_date">;
        Update: Partial<PurchaseOrder>;
      };
      po_items: {
        Row: POItem;
        Insert: Partial<POItem> &
          Pick<POItem, "po_id" | "line_no" | "description" | "quantity" | "unit" | "unit_price">;
        Update: Partial<POItem>;
      };
      approvals: {
        Row: Approval;
        Insert: Partial<Approval> &
          Pick<Approval, "reference_type" | "reference_id" | "step" | "approver_id">;
        Update: Partial<Approval>;
      };
      branches: {
        Row: Branch;
        Insert: Partial<Branch> & Pick<Branch, "code" | "name">;
        Update: Partial<Branch>;
      };
      expense_requests: {
        Row: ExpenseRequest;
        Insert: Partial<ExpenseRequest> &
          Pick<ExpenseRequest, "request_number" | "title" | "requester_id" | "branch_id" | "request_date">;
        Update: Partial<ExpenseRequest>;
      };
      expense_items: {
        Row: ExpenseItem;
        Insert: Partial<ExpenseItem> & Pick<ExpenseItem, "expense_id" | "description" | "amount">;
        Update: Partial<ExpenseItem>;
      };
      goods_receipts: {
        Row: GoodsReceipt;
        Insert: Partial<GoodsReceipt> &
          Pick<GoodsReceipt, "gr_number" | "po_id" | "received_by" | "received_date">;
        Update: Partial<GoodsReceipt>;
      };
      gr_items: {
        Row: GRItem;
        Insert: Partial<GRItem> & Pick<GRItem, "gr_id" | "po_item_id" | "received_qty">;
        Update: Partial<GRItem>;
      };
    };
    Enums: {
      user_role: UserRole;
      pr_status: PrStatus;
      po_status: PoStatus;
      approval_decision: ApprovalDecision;
      expense_status: ExpenseStatus;
    };
  };
}
