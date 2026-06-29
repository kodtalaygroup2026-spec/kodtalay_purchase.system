// ===========================================================================
// File: src/lib/utils/format.ts
// คำอธิบาย: ฟังก์ชันช่วยจัดรูปแบบข้อมูล (เงิน, วันที่) เป็นรูปแบบไทย
// ===========================================================================

/** จัดรูปแบบจำนวนเงินเป็นบาท เช่น 5000 → "฿5,000", 249.99 → "฿249.99" */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("th-TH", {
    style: "currency",
    currency: "THB",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
}

/** จัดรูปแบบวันที่เป็นแบบไทย เช่น "24 มิ.ย. 2569" */
export function formatDate(date: string | Date | null): string {
  if (!date) return "-";
  return new Intl.DateTimeFormat("th-TH", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(date));
}

/** จัดรูปแบบวันที่ + เวลา เช่น "24 มิ.ย. 2569 14:30" */
export function formatDateTime(date: string | Date | null): string {
  if (!date) return "-";
  return new Intl.DateTimeFormat("th-TH", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(date));
}
