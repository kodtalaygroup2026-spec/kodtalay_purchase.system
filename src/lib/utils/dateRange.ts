// ===========================================================================
// File: src/lib/utils/dateRange.ts
// คำอธิบาย: ฟังก์ชันช่วยจัดการ "ช่วงวันที่" สำหรับตัวกรองในตาราง
//           ใช้รูปแบบ "YYYY-MM-DD" ตามเวลาท้องถิ่น (ตรงกับค่าของ <input type="date">)
// ===========================================================================

export interface DateRange {
  from: string | null; // "YYYY-MM-DD"
  to: string | null;   // "YYYY-MM-DD"
}

export const EMPTY_DATE_RANGE: DateRange = { from: null, to: null };

/** แปลง Date เป็น "YYYY-MM-DD" ตามเวลาท้องถิ่น (ไม่ใช้ toISOString เพราะจะเลื่อนเป็น UTC) */
export function toISODate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/** true เมื่อไม่ได้เลือกช่วงวันที่ไว้เลย */
export function isRangeEmpty(range: DateRange): boolean {
  return !range.from && !range.to;
}

/**
 * ตรวจว่า timestamp อยู่ในช่วงที่เลือกหรือไม่
 * - ไม่เลือกช่วง → ผ่านทุกแถว
 * - แถวไม่มีวันที่ → ตกทันทีเมื่อมีการเลือกช่วง
 */
export function isDateInRange(value: string | null | undefined, range: DateRange): boolean {
  if (isRangeEmpty(range)) return true;
  if (!value) return false;

  const day = toISODate(new Date(value));
  if (range.from && day < range.from) return false;
  if (range.to && day > range.to) return false;
  return true;
}

/** ช่วงวันที่สำเร็จรูปที่ใช้บ่อย — คืนค่าตามวันปัจจุบันของเครื่องผู้ใช้ */
export function presetRange(
  key: "today" | "last7" | "last30" | "thisMonth" | "lastMonth"
): DateRange {
  const today = new Date();

  switch (key) {
    case "today":
      return { from: toISODate(today), to: toISODate(today) };

    case "last7": {
      const start = new Date(today);
      start.setDate(start.getDate() - 6); // นับวันนี้เป็นวันที่ 7
      return { from: toISODate(start), to: toISODate(today) };
    }

    case "last30": {
      const start = new Date(today);
      start.setDate(start.getDate() - 29);
      return { from: toISODate(start), to: toISODate(today) };
    }

    case "thisMonth": {
      const start = new Date(today.getFullYear(), today.getMonth(), 1);
      return { from: toISODate(start), to: toISODate(today) };
    }

    case "lastMonth": {
      const start = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      const end = new Date(today.getFullYear(), today.getMonth(), 0); // วันสุดท้ายของเดือนก่อน
      return { from: toISODate(start), to: toISODate(end) };
    }
  }
}
