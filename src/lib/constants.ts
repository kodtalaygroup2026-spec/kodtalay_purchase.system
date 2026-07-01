// ===========================================================================
// File: src/lib/constants.ts
// คำอธิบาย: ค่าคงที่และ label ภาษาไทยสำหรับสถานะ/บทบาท ใช้ร่วมกันทั้งระบบ
// ===========================================================================
import type { ConstructionStatus, ExpenseStatus, PaymentRequestStatus, PoStatus, PrStatus, UserRole } from "@/types/database";

// เวอร์ชันของระบบ (อัปเดตทุกครั้งที่มีการเปลี่ยนแปลงสำคัญ)
export const APP_VERSION = "0.1.0";
export const APP_NAME = "ระบบจัดซื้อ Kodtalay";

// label ภาษาไทยของบทบาทผู้ใช้
export const ROLE_LABELS: Record<UserRole, string> = {
  admin: "ผู้ดูแลระบบ",
  manager: "หัวหน้า",
  employee: "พนักงาน",
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
  pending_second_approval: "รออนุมัติรอบ 2",
  returned: "ตีกลับ",
  pending_finance: "รอการเงิน",
  paid: "จ่ายแล้ว",
};

// label ภาษาไทยของสถานะงานก่อสร้าง
export const CONSTRUCTION_STATUS_LABELS: Record<ConstructionStatus, string> = {
  open: "เปิดงาน",
  boq_pending: "รออนุมัติ BOQ",
  boq_approved: "BOQ อนุมัติแล้ว",
  payment_pending: "รออนุมัติเบิก",
  payment_approved: "อนุมัติเบิกแล้ว",
  closed: "ปิดงาน",
};

// label ภาษาไทยของสถานะขอเบิก
export const PAYMENT_STATUS_LABELS: Record<PaymentRequestStatus, string> = {
  pending: "รอตรวจรับ",
  inspected: "ตรวจรับแล้ว",
  approved: "อนุมัติแล้ว",
  rejected: "ไม่อนุมัติ",
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

// รายชื่อแผนกในองค์กร (ใช้เป็น dropdown ในหน้าโปรไฟล์)
export const DEPARTMENTS: string[] = [
  "ฝ่ายจัดซื้อ",
  "ฝ่ายครัว",
  "ฝ่ายปฏิบัติการหน้าร้าน",
  "ฝ่ายการเงินและบัญชี",
  "ฝ่ายการตลาด",
  "ฝ่ายทรัพยากรบุคคล",
  "ฝ่ายวิศวกรรมและช่าง",
  "ทีมผู้บริหาร",
];
