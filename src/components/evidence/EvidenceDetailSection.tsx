import { formatDateTime } from "@/lib/utils/format";
import { FileText, ImageIcon, Package, ExternalLink, CheckCircle2 } from "lucide-react";

const BANK_LABELS: Record<string, string> = {
  KBANK: "กสิกรไทย", SCB: "ไทยพาณิชย์", BBL: "กรุงเทพ", KTB: "กรุงไทย",
  TTB: "ทีทีบี", BAY: "กรุงศรีอยุธยา", GSB: "ออมสิน", GHB: "อาคารสงเคราะห์",
  BAAC: "ธ.ก.ส.", KKP: "เกียรตินาคิน", CIMBT: "ซีไอเอ็มบี", UOB: "ยูโอบี",
  TISCO: "ทิสโก้", LHB: "แลนด์แอนด์เฮ้าส์",
};

const EVIDENCE_TYPE_CONFIG: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  bill:          { label: "บิล / ใบเสร็จ",       icon: FileText,   color: "text-orange-500 bg-orange-50" },
  slip:          { label: "สลิปการโอนเงิน",       icon: ImageIcon,  color: "text-blue-500 bg-blue-50" },
  goods_receipt: { label: "รูปถ่ายการรับของ",     icon: Package,    color: "text-green-500 bg-green-50" },
  other:         { label: "อื่นๆ",               icon: FileText,   color: "text-slate-500 bg-slate-50" },
};

function formatFileSize(bytes: number | null): string {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

interface EvidenceFile {
  id: string;
  file_name: string;
  file_url: string;
  evidence_type: "bill" | "slip" | "goods_receipt" | "other";
  file_size: number | null;
}

interface EvidenceDetailSectionProps {
  evidence: {
    id: string;
    account_holder_name: string;
    bank_name: string | null;
    bank_account_number: string | null;
    notes: string | null;
    submitted_at: string;
  };
  files: EvidenceFile[];
}

export function EvidenceDetailSection({ evidence, files }: EvidenceDetailSectionProps) {
  const filesByType = (["bill", "slip", "goods_receipt", "other"] as const).reduce(
    (acc, type) => ({ ...acc, [type]: files.filter(f => f.evidence_type === type) }),
    {} as Record<string, EvidenceFile[]>
  );

  const bankLabel = evidence.bank_name
    ? BANK_LABELS[evidence.bank_name] ?? evidence.bank_name
    : null;

  return (
    <div className="space-y-4">

      {/* ส่วนหัว */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center gap-2">
          <CheckCircle2 size={16} className="text-green-500" />
          <h3 className="font-semibold text-slate-700">หลักฐานการรับของ</h3>
          <span className="ml-auto rounded-full bg-green-100 px-2.5 py-0.5 text-[11px] font-semibold text-green-700">
            ส่งแล้ว
          </span>
        </div>

        {/* ข้อมูลผู้รับเงิน */}
        <div className="mb-4 rounded-lg border border-slate-100 bg-slate-50 px-4 py-3">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-slate-400">
            ข้อมูลบัญชีรับเงิน
          </p>
          <div className="grid grid-cols-1 gap-y-1 text-sm sm:grid-cols-3">
            <div>
              <p className="text-xs text-slate-500">ชื่อเจ้าของบัญชี</p>
              <p className="font-semibold text-slate-800">{evidence.account_holder_name}</p>
            </div>
            {bankLabel && (
              <div>
                <p className="text-xs text-slate-500">ธนาคาร</p>
                <p className="font-medium text-slate-800">{bankLabel}</p>
              </div>
            )}
            {evidence.bank_account_number && (
              <div>
                <p className="text-xs text-slate-500">เลขที่บัญชี</p>
                <p className="font-mono font-medium text-slate-800 tracking-wider">
                  {evidence.bank_account_number}
                </p>
              </div>
            )}
          </div>
        </div>

        {evidence.notes && (
          <div className="mb-4">
            <p className="text-xs text-slate-500">หมายเหตุ</p>
            <p className="text-sm text-slate-700">{evidence.notes}</p>
          </div>
        )}

        <p className="text-xs text-slate-400">ส่งเมื่อ {formatDateTime(evidence.submitted_at)}</p>
      </div>

      {/* ไฟล์แนบแยกตามประเภท */}
      {(["bill", "slip", "goods_receipt"] as const).map(type => {
        const typeFiles = filesByType[type] ?? [];
        if (typeFiles.length === 0) return null;
        const config = EVIDENCE_TYPE_CONFIG[type];
        const Icon = config.icon;

        return (
          <div key={type} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-3 flex items-center gap-2">
              <div className={`flex h-7 w-7 items-center justify-center rounded-full ${config.color.split(" ")[1]}`}>
                <Icon size={14} className={config.color.split(" ")[0]} />
              </div>
              <h3 className="text-sm font-semibold text-slate-700">{config.label}</h3>
              <span className="text-xs text-slate-400">({typeFiles.length} ไฟล์)</span>
            </div>
            <ul className="space-y-2">
              {typeFiles.map(file => {
                const isImage = file.file_name.match(/\.(jpg|jpeg|png|webp)$/i);
                return (
                  <li key={file.id} className="flex items-center gap-3 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
                    <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded ${isImage ? "bg-blue-50" : "bg-red-50"}`}>
                      {isImage
                        ? <ImageIcon size={16} className="text-blue-400" />
                        : <FileText size={16} className="text-red-400" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-slate-700">{file.file_name}</p>
                      {file.file_size && (
                        <p className="text-xs text-slate-400">{formatFileSize(file.file_size)}</p>
                      )}
                    </div>
                    <a
                      href={file.file_url}
                      target="_blank"
                      rel="noreferrer"
                      className="shrink-0 flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-600 transition hover:bg-slate-100"
                    >
                      ดู <ExternalLink size={10} />
                    </a>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </div>
  );
}
