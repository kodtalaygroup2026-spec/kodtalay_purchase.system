// ===========================================================================
// File: src/lib/utils/format.ts
// คำอธิบาย: ฟังก์ชันช่วยจัดรูปแบบข้อมูล (เงิน, วันที่) เป็นรูปแบบไทย
// ===========================================================================

/** จัดรูปแบบจำนวนเงินเป็นบาท เช่น 1234.5 → "฿1,234.50" */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("th-TH", {
    style: "currency",
    currency: "THB",
    minimumFractionDigits: 2,
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
