// KTB Smart Business 3RD Party Transfer file generator
// Format: pipe-delimited UTF-8 text, 1 H row + N D rows

export interface KTBCompanySettings {
  payerAbbreviation: string;   // ≤10 chars
  companyNameTH: string;
  companyNameEN: string;
  address: string;
  province: string;
  district: string;
  subDistrict: string;
  postalCode: string;
  taxId: string;               // 13 digits
  ktbCompanyId: string;        // Company ID in KTB Smart Biz
  payerAccount: string;        // 10-digit payer KTB account
}

export interface KTBRecipient {
  seqNo: number;
  name: string;
  accountNumber: string;  // 10-digit KTB account
  branchCode: string;     // 4-digit KTB branch code
  amount: number;         // baht (integer)
}

export interface KTBBatchInfo {
  batchNo: string;        // padded to 6 digits
  customerRefNo: string;
  effectiveDate: string;  // YYYY-MM-DD → converted to DDMMYYYY in file
}

function toKTBDate(dateStr: string): string {
  const [y, m, d] = dateStr.split("-");
  return `${d}${m}${y}`;
}

export function generateKTBContent(
  settings: KTBCompanySettings,
  recipients: KTBRecipient[],
  batch: KTBBatchInfo
): string {
  const batchNo = batch.batchNo.padStart(6, "0");
  const effectiveDate = toKTBDate(batch.effectiveDate);
  const total = recipients.reduce((sum, r) => sum + Math.round(r.amount), 0);

  const headerRow = [
    "10", "H", batchNo,
    String(recipients.length),
    batch.customerRefNo,
    settings.payerAbbreviation,
    settings.companyNameTH,
    settings.companyNameEN,
    settings.address,
    settings.province,
    settings.district,
    settings.subDistrict,
    settings.postalCode,
    settings.taxId,
    "", "", "",
    "C",
    settings.ktbCompanyId,
    "3",
    String(total),
    "0", "0", "0",
    effectiveDate,
    "0", "0", "0", "0", "0", "",
  ].join("|");

  const detailRows = recipients.map((r) => [
    "10", "D", batchNo,
    String(r.seqNo),
    "3RD",
    "006",                              // KTB bank code
    r.branchCode.padStart(4, "0"),
    "",
    r.accountNumber,
    r.name,
    "-",
    settings.province,
    settings.district,
    settings.subDistrict,
    settings.postalCode,
    "N",
    settings.payerAccount,
    effectiveDate,
    String(r.seqNo).padStart(2, "0"),
    "OUR",
    "0", "0", "0", "0", "0", "0",
    String(Math.round(r.amount)),
    "", "", "", "",
  ].join("|"));

  return [headerRow, ...detailRows].join("\r\n");
}

export function validateKTBSettings(settings: KTBCompanySettings): string[] {
  const errors: string[] = [];
  if (!settings.payerAbbreviation) errors.push("ชื่อย่อบริษัท");
  if (!settings.companyNameTH) errors.push("ชื่อบริษัท (ไทย)");
  if (!settings.companyNameEN) errors.push("ชื่อบริษัท (อังกฤษ)");
  if (!settings.address) errors.push("ที่อยู่");
  if (!settings.province) errors.push("จังหวัด");
  if (!settings.taxId) errors.push("เลขประจำตัวผู้เสียภาษี");
  if (!settings.ktbCompanyId) errors.push("Company ID (KTB)");
  if (!settings.payerAccount || settings.payerAccount.length !== 10)
    errors.push("เลขบัญชีต้นทาง (ต้องมี 10 หลัก)");
  return errors;
}
