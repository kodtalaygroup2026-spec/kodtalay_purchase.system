// รูปแบบเลขบัญชีธนาคารไทย
// mask: # = ตัวเลข 1 หลัก, ตัวอักษรอื่น = ตัวคั่น (เช่น -)

export interface BankFormat {
  code: string;
  label: string;
  digits: number;  // จำนวนหลักทั้งหมด (ไม่นับ -)
  mask: string;    // เช่น "###-#-#####-#"
}

export const BANK_FORMATS: BankFormat[] = [
  { code: "KBANK", label: "กสิกรไทย (KBANK)",        digits: 10, mask: "###-#-#####-#"      },
  { code: "SCB",   label: "ไทยพาณิชย์ (SCB)",         digits: 10, mask: "###-######-#"        },
  { code: "BBL",   label: "กรุงเทพ (BBL)",             digits: 10, mask: "###-#-#####-#"      },
  { code: "KTB",   label: "กรุงไทย (KTB)",             digits: 10, mask: "###-#-#####-#"      },
  { code: "TTB",   label: "ทีทีบี (TTB)",               digits: 10, mask: "###-#-#####-#"      },
  { code: "BAY",   label: "กรุงศรีอยุธยา (BAY)",       digits: 10, mask: "###-#-#####-#"      },
  { code: "GSB",   label: "ออมสิน (GSB)",               digits: 15, mask: "####-######-####-#"  }, // 4+6+4+1=15
  { code: "GHB",   label: "อาคารสงเคราะห์ (GHB)",     digits: 10, mask: "##########"          },
  { code: "BAAC",  label: "ธ.ก.ส. (BAAC)",             digits: 12, mask: "###-#-########"     }, // 3+1+8=12
  { code: "KKP",   label: "เกียรตินาคิน (KKP)",        digits: 10, mask: "###-#-#####-#"      },
  { code: "CIMBT", label: "ซีไอเอ็มบี (CIMBT)",        digits: 10, mask: "##########"          },
  { code: "UOB",   label: "ยูโอบี (UOB)",               digits: 10, mask: "###-######-#"        },
  { code: "TISCO", label: "ทิสโก้ (TISCO)",             digits: 10, mask: "###-#-#####-#"      },
  { code: "LHB",   label: "แลนด์แอนด์เฮ้าส์ (LHB)",  digits: 10, mask: "###-#-#####-#"      },
];

/** หา format จาก bank code */
export function getBankFormat(code: string): BankFormat | undefined {
  return BANK_FORMATS.find((b) => b.code === code);
}

/** ดึงเฉพาะตัวเลขออกจากสตริง */
export function extractDigits(value: string): string {
  return value.replace(/\D/g, "");
}

/** ใส่ตัวคั่นตาม mask — รับ raw digits เท่านั้น */
export function applyMask(rawDigits: string, mask: string): string {
  let di = 0;
  let result = "";
  for (const ch of mask) {
    if (di >= rawDigits.length) break;
    if (ch === "#") {
      result += rawDigits[di++];
    } else {
      // ใส่ตัวคั่นก็ต่อเมื่อยังมีตัวเลขข้างหน้าอีก
      result += ch;
    }
  }
  return result;
}

/** placeholder เช่น "000-0-00000-0" จาก mask "###-#-#####-#" */
export function getMaskPlaceholder(mask: string): string {
  return mask.replace(/#/g, "0");
}

/** ตรวจว่ากรอกครบตามจำนวนหลักของธนาคารนั้นๆ */
export function isAccountComplete(value: string, bankCode: string): boolean {
  const fmt = getBankFormat(bankCode);
  if (!fmt) return value.trim().length > 0;
  return extractDigits(value).length === fmt.digits;
}

/** format ค่าที่รับ input — ใช้ใน onChange */
export function formatAccountInput(rawInput: string, bankCode: string): string {
  const fmt = getBankFormat(bankCode);
  if (!fmt) return rawInput;
  const digits = extractDigits(rawInput).slice(0, fmt.digits);
  return applyMask(digits, fmt.mask);
}
