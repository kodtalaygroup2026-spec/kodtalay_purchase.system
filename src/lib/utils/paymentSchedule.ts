// บช. ตัดจ่ายทุกวันพุธ (day=3) และวันศุกร์ (day=5)
const PAYMENT_DAYS = [3, 5]; // 0=Sun … 6=Sat

/**
 * คำนวณวันตัดจ่ายถัดไป (ไม่นับวันนี้ แม้วันนี้จะเป็นพุธ/ศุกร์)
 * พุธอยู่ในรอบ → เลื่อนเป็นศุกร์, ศุกร์อยู่ในรอบ → เลื่อนเป็นพุธหน้า
 */
export function getNextPaymentDate(from: Date = new Date()): Date {
  const d = new Date(from);
  d.setHours(0, 0, 0, 0);

  for (let i = 1; i <= 7; i++) {
    const candidate = new Date(d);
    candidate.setDate(d.getDate() + i);
    if (PAYMENT_DAYS.includes(candidate.getDay())) return candidate;
  }

  // fallback (ไม่ควรถึง)
  return d;
}

/** แสดงวันในรูปแบบ "วันพุธที่ 9 ก.ค." */
export function formatPaymentDate(date: Date): string {
  return date.toLocaleDateString("th-TH", {
    weekday: "long",
    day: "numeric",
    month: "short",
  });
}

/** ป้าย short สำหรับ tooltip/toast เช่น "พ. 9 ก.ค." */
export function formatPaymentDateShort(date: Date): string {
  return date.toLocaleDateString("th-TH", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}
