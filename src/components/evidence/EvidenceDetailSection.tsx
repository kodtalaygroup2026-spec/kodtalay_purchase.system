"use client";

import { useState } from "react";
import { formatDateTime } from "@/lib/utils/format";
import { FileText, ImageIcon, Package, X, CheckCircle2, ZoomIn } from "lucide-react";

const EVIDENCE_TYPE_CONFIG = {
  bill:          { label: "บิล / ใบเสร็จ",   icon: FileText,  color: "text-orange-500", bg: "bg-orange-50",  required: true  },
  slip:          { label: "สลิปการโอนเงิน",   icon: ImageIcon, color: "text-blue-500",   bg: "bg-blue-50",    required: false },
  goods_receipt: { label: "รูปถ่ายการรับของ", icon: Package,   color: "text-green-500",  bg: "bg-green-50",   required: true  },
} as const;

function isImageFile(name: string) {
  return /\.(jpg|jpeg|png|webp|gif)$/i.test(name);
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
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  const filesByType = (Object.keys(EVIDENCE_TYPE_CONFIG) as Array<keyof typeof EVIDENCE_TYPE_CONFIG>).reduce(
    (acc, type) => ({ ...acc, [type]: files.filter((f) => f.evidence_type === type) }),
    {} as Record<keyof typeof EVIDENCE_TYPE_CONFIG, EvidenceFile[]>
  );

  return (
    <>
      {/* ── Card หัว ── */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center gap-2">
          <CheckCircle2 size={16} className="text-green-500" />
          <h3 className="font-semibold text-slate-700">หลักฐานการรับของ</h3>
          <span className="ml-auto rounded-full bg-green-100 px-2.5 py-0.5 text-[11px] font-semibold text-green-700">
            ส่งแล้ว
          </span>
        </div>

        {evidence.notes && (
          <p className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">
            {evidence.notes}
          </p>
        )}

        <p className="mt-3 text-xs text-slate-400">ส่งเมื่อ {formatDateTime(evidence.submitted_at)}</p>
      </div>

      {/* ── Card ไฟล์แนบ ── */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
        {(Object.entries(EVIDENCE_TYPE_CONFIG) as Array<[keyof typeof EVIDENCE_TYPE_CONFIG, typeof EVIDENCE_TYPE_CONFIG[keyof typeof EVIDENCE_TYPE_CONFIG]]>).map(([type, config], idx, arr) => {
          const typeFiles = filesByType[type] ?? [];
          const Icon = config.icon;
          const isEmpty = typeFiles.length === 0;

          return (
            <div
              key={type}
              className={`px-5 py-4 ${idx < arr.length - 1 ? "border-b border-slate-100" : ""}`}
            >
              {/* หัวข้อ */}
              <div className="mb-3 flex items-center gap-2">
                <div className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${config.bg}`}>
                  <Icon size={12} className={config.color} />
                </div>
                <span className="text-xs font-semibold text-slate-600">{config.label}</span>
                {!isEmpty && (
                  <span className="text-[11px] text-slate-400">{typeFiles.length} ไฟล์</span>
                )}
                {!config.required && (
                  <span className="ml-auto text-[10px] text-slate-300">ไม่บังคับ</span>
                )}
              </div>

              {/* ไฟล์ หรือ empty */}
              {isEmpty ? (
                <div className="flex items-center justify-center py-3">
                  <p className="text-[11px] text-slate-300">— ไม่มีไฟล์แนบ —</p>
                </div>
              ) : (
                <div className="flex flex-wrap justify-center gap-3">
                  {typeFiles.map((file) => {
                    if (isImageFile(file.file_name)) {
                      return (
                        <button
                          key={file.id}
                          onClick={() => setLightboxUrl(file.file_url)}
                          title={file.file_name}
                          className="group flex flex-col items-center gap-1.5"
                        >
                          <div className="relative h-32 w-32 shrink-0 overflow-hidden rounded-xl border border-slate-200 bg-slate-100 shadow-sm transition-all duration-200 group-hover:shadow-lg group-hover:ring-2 group-hover:ring-blue-400 group-hover:ring-offset-2">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={file.file_url}
                              alt={file.file_name}
                              className="h-full w-full object-cover transition duration-200 group-hover:scale-105"
                            />
                            <div className="absolute inset-0 flex items-center justify-center bg-black/0 transition group-hover:bg-black/25">
                              <ZoomIn size={20} className="text-white opacity-0 drop-shadow transition group-hover:opacity-100" />
                            </div>
                          </div>
                          <span className="max-w-[8rem] truncate text-center text-[10px] text-slate-400">
                            {file.file_name}
                          </span>
                        </button>
                      );
                    }

                    return (
                      <a
                        key={file.id}
                        href={file.file_url}
                        target="_blank"
                        rel="noreferrer"
                        title={file.file_name}
                        className="group flex flex-col items-center gap-1.5"
                      >
                        <div className="flex h-32 w-32 shrink-0 flex-col items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-50 shadow-sm transition-all duration-200 group-hover:border-red-300 group-hover:bg-red-50 group-hover:shadow-lg">
                          <FileText size={30} className="text-red-400 transition group-hover:text-red-500" />
                          <span className="line-clamp-2 px-2 text-center text-[9px] leading-tight text-slate-500">
                            {file.file_name}
                          </span>
                        </div>
                        <span className="text-[10px] text-slate-400">PDF</span>
                      </a>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ── Lightbox ── */}
      {lightboxUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
          onClick={() => setLightboxUrl(null)}
        >
          <button
            className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full bg-white/15 text-white transition hover:bg-white/25"
            onClick={() => setLightboxUrl(null)}
          >
            <X size={20} />
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={lightboxUrl}
            alt=""
            className="max-h-[88vh] max-w-[88vw] rounded-xl object-contain shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </>
  );
}
