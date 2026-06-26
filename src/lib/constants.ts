// ===========================================================================
// File: src/lib/constants.ts
// คำอธิบาย: ค่าคงที่และ label ภาษาไทยสำหรับสถานะ/บทบาท ใช้ร่วมกันทั้งระบบ
// ===========================================================================
import type { ExpenseStatus, PoStatus, PrStatus, UserRole } from "@/types/database";

// เวอร์ชันของระบบ (อัปเดตทุกครั้งที่มีการเปลี่ยนแปลงสำคัญ)
export const APP_VERSION = "0.1.0";
export const APP_NAME = "ระบบจัดซื้อ Kodtalay";

// label ภาษาไทยของบทบาทผู้ใช้
export const ROLE_LABELS: Record<UserRole, string> = {
  admin: "ผู้ดูแลระบบ",
  manager: "ผู้อนุมัติ",
  purchaser: "เจ้าหน้าที่จัดซื้อ",
  requester: "ผู้ขอซื้อ",
  viewer: "ผู้ดูข้อมูล",
  finance: "ฝ่ายการเงิน",
};

// label ภาษาไทยของสถานะใบขอซื้อ (PR)
export const PR_STATUS_LABELS: Record<PrStatus, string> = {
  draft: "ร่าง",
  submitted: "รออนุมัติ",
  approved: "อนุมัติแล้ว",
  rejected: "ไม่อนุมัติ",
  cancelled: "ยกเลิก",
  converted: "ออก PO แล้ว",
};

// label ภาษาไทยของสถานะใบสั่งซื้อ (PO)
export const PO_STATUS_LABELS: Record<PoStatus, string> = {
  draft: "ร่าง",
  pending_approval: "รออนุมัติ",
  approved: "อนุมัติแล้ว",
  sent: "ส่งให้ผู้ขายแล้ว",
  partially_received: "รับของบางส่วน",
  received: "รับของครบ",
  closed: "ปิดงาน",
  cancelled: "ยกเลิก",
};

// label ภาษาไทยของสถานะใบเบิกค่าใช้จ่าย (Expense)
export const EXPENSE_STATUS_LABELS: Record<ExpenseStatus, string> = {
  draft: "ร่าง",
  submitted: "รออนุมัติ",
  approved: "อนุมัติแล้ว",
  rejected: "ไม่อนุมัติ",
  paid: "จ่ายแล้ว",
  cancelled: "ยกเลิก",
};

// อัตรา VAT เริ่มต้น (%)
export const DEFAULT_VAT_RATE = 7;
