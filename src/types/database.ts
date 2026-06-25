// ===========================================================================
// File: src/types/database.ts
// คำอธิบาย: TypeScript types ของสคีมาฐานข้อมูล (สอดคล้องกับ migration 0001)
// หมายเหตุ: ไฟล์นี้เขียนด้วยมือสำหรับ scaffold เริ่มต้น
//          เมื่อ schema เริ่มนิ่ง แนะนำให้ generate อัตโนมัติด้วยคำสั่ง:
//          npx supabase gen types typescript --project-id <ref> > src/types/database.ts
// ===========================================================================

export type UserRole = "admin" | "manager" | "purchaser" | "requester" | "viewer";

export type PrStatus =
  | "draft"
  | "submitted"
  | "approved"
  | "rejected"
  | "cancelled"
  | "converted";

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

// โครงสร้างกลางของแถวในแต่ละตาราง
export interface Profile {
  id: string;
  full_name: string;
  email: string;
  department: string | null;
  role: UserRole;
  is_active: boolean;
  created_at: string;
  updated_at: string;
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
  created_at: string;
  updated_at: string;
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

// ---------------------------------------------------------------------------
// โครงสร้าง Database ที่ใช้กับ supabase-js เพื่อให้ query มี type ครบ
// (ใส่เฉพาะตารางหลักไว้ก่อนใน scaffold — เพิ่มเติมได้ภายหลัง)
// ---------------------------------------------------------------------------
export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: Profile;
        Insert: Partial<Profile> & Pick<Profile, "id" | "email">;
        Update: Partial<Profile>;
      };
      suppliers: {
        Row: Supplier;
        Insert: Partial<Supplier> & Pick<Supplier, "code" | "name">;
        Update: Partial<Supplier>;
      };
      products: {
        Row: Product;
        Insert: Partial<Product> & Pick<Product, "sku" | "name">;
        Update: Partial<Product>;
      };
      purchase_requisitions: {
        Row: PurchaseRequisition;
        Insert: Partial<PurchaseRequisition> &
          Pick<PurchaseRequisition, "pr_number" | "title" | "requester_id">;
        Update: Partial<PurchaseRequisition>;
      };
      purchase_orders: {
        Row: PurchaseOrder;
        Insert: Partial<PurchaseOrder> &
          Pick<PurchaseOrder, "po_number" | "supplier_id" | "created_by">;
        Update: Partial<PurchaseOrder>;
      };
    };
    Enums: {
      user_role: UserRole;
      pr_status: PrStatus;
      po_status: PoStatus;
      approval_decision: ApprovalDecision;
    };
  };
}
