"use client";

import { Check } from "lucide-react";

// รายการเอกสารกระดาษตัวจริงที่ฝ่ายบัญชีใช้เช็คตอนยืนยัน "ไม่สมบูรณ์"
// (แก้/เพิ่มรายการได้ที่นี่ที่เดียว — ใช้ร่วมทั้งหน้าจ่ายเงินและหน้าตรวจเอกสารที่แก้แล้ว)
export const MISSING_DOC_OPTIONS = [
  "บิล / ใบเสร็จรับเงินตัวจริง",
  "ใบกำกับภาษี",
  "ใบส่งของ / หลักฐานการรับของ",
  "ใบสำคัญรับเงิน / ใบเบิก",
  "เอกสารไม่ชัด / อ่านไม่ออก",
  "ยอดเงิน / รายละเอียดไม่ตรง",
];

/**
 * รวมรายการที่ติ๊ก + หมายเหตุ ให้เป็นข้อความเดียวสำหรับเก็บลง review_note
 * (พนักงานจะเห็นเป็นข้อความว่าเอกสารส่วนไหนขาด/ผิด และหมายเหตุเพิ่มเติม)
 */
export function buildIncompleteNote(selected: string[], note: string): string {
  const parts: string[] = [];
  if (selected.length > 0) parts.push(`เอกสารที่ขาด/ไม่ถูกต้อง: ${selected.join(", ")}`);
  const trimmedNote = note.trim();
  if (trimmedNote) parts.push(`หมายเหตุ: ${trimmedNote}`);
  return parts.join("\n");
}

interface MissingDocsChecklistProps {
  selected: string[];
  onChange: (next: string[]) => void;
}

// ตารางติ๊กเลือกเอกสารที่ขาด/ผิด — บช. กดเลือกได้หลายรายการ
export function MissingDocsChecklist({ selected, onChange }: MissingDocsChecklistProps) {
  function toggle(item: string) {
    onChange(
      selected.includes(item)
        ? selected.filter((i) => i !== item)
        : [...selected, item]
    );
  }

  return (
    <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
      {MISSING_DOC_OPTIONS.map((item) => {
        const isOn = selected.includes(item);
        return (
          <button
            type="button"
            key={item}
            onClick={() => toggle(item)}
            className={`flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-left text-xs transition ${
              isOn
                ? "border-amber-500 bg-amber-100 text-amber-800"
                : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
            }`}
          >
            <span
              className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                isOn ? "border-amber-500 bg-amber-500 text-white" : "border-slate-300"
              }`}
            >
              {isOn && <Check size={11} strokeWidth={3} />}
            </span>
            <span className="flex-1">{item}</span>
          </button>
        );
      })}
    </div>
  );
}
