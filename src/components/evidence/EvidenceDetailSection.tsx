"use client";

import { useState } from "react";
import { formatDateTime } from "@/lib/utils/format";
import { FileText, ImageIcon, Package, X, CheckCircle2, ZoomIn } from "lucide-react";

const EVIDENCE_TYPE_CONFIG = {
  bill:          { label: "บิล / ใบเสร็จ",    icon: FileText,  color: "text-orange-500", bg: "bg-orange-50"  },
  slip:          { label: "สลิปการโอนเงิน",    icon: ImageIcon, color: "text-blue-500",   bg: "bg-blue-50"    },
  goods_receipt: { label: "รูปถ่ายการรับของ",  icon: Package,   color: "text-green-500",  bg: "bg-green-50"   },
  other:         { label: "อื่นๆ",             icon: FileText,  color: "text-slate-500",  bg: "bg-slate-50"   },
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

  const filesByType = (["bill", "slip", "goods_receipt", "other"] as const).reduce(
    (acc, type) => ({ ...acc, [type]: files.filter((f) => f.evidence_type === type) }),
    {} as Record<string, EvidenceFile[]>
  );

  const hasFiles = files.length > 0;

  return (
    <>
      {/* ── Card หัว ── */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-3 flex items-center gap-2">
          <CheckCircle2 size={16} className="text-green-500" />
          <h3 className="font-semibold text-slate-700">หลักฐานการรับของ</h3>
          <span className="ml-auto rounded-full bg-green-100 px-2.5 py-0.5 text-[11px] font-semibold text-green-700">
            ส่งแล้ว
          </span>
        </div>

        {evidence.notes && (
          <div className="mb-3">
            <p className="text-xs text-slate-500">หมายเหตุ</p>
            <p className="text-sm text-slate-700">{evidence.notes}</p>
          </div>
        )}

        <p className="text-xs text-slate-400">ส่งเมื่อ {formatDateTime(evidence.submitted_at)}</p>
      </div>

      {/* ── Card ไฟล์แนบรวม ── */}
      {hasFiles && (
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="divide-y divide-slate-100">
            {(["bill", "slip", "goods_receipt", "other"] as const).map((type) => {
              const typeFiles = filesByType[type] ?? [];
              if (typeFiles.length === 0) return null;
              const config = EVIDENCE_TYPE_CONFIG[type];
              const Icon = config.icon;

              return (
                <div key={type} className="py-4 first:pt-0 last:pb-0">
                  {/* หัวข้อแต่ละหมวด */}
                  <div className="mb-3 flex items-center gap-2">
                    <div className={`flex h-6 w-6 items-center justify-center rounded-full ${config.bg}`}>
                      <Icon size={13} className={config.color} />
                    </div>
                    <span className="text-xs font-semibold text-slate-600">{config.label}</span>
                    <span className="text-[11px] text-slate-400">{typeFiles.length} ไฟล์</span>
                  </div>

                  {/* Thumbnail grid */}
                  <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                    {typeFiles.map((file) => {
                      if (isImageFile(file.file_name)) {
                        return (
                          <button
                            key={file.id}
                            onClick={() => setLightboxUrl(file.file_url)}
                            className="group relative aspect-square overflow-hidden rounded-lg border border-slate-200 bg-slate-100 transition hover:border-blue-300"
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={file.file_url}
                              alt={file.file_name}
                              className="h-full w-full object-cover transition group-hover:scale-105"
                            />
                            <div className="absolute inset-0 flex items-center justify-center bg-black/0 transition group-hover:bg-black/20">
                              <ZoomIn size={20} className="text-white opacity-0 transition group-hover:opacity-100 drop-shadow" />
                            </div>
                          </button>
                        );
                      }

                      // PDF / non-image
                      return (
                        <a
                          key={file.id}
                          href={file.file_url}
                          target="_blank"
                          rel="noreferrer"
                          className="group flex aspect-square flex-col items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 p-2 transition hover:bg-red-50 hover:border-red-200"
                        >
                          <FileText size={24} className="text-red-400 transition group-hover:text-red-500" />
                          <span className="line-clamp-2 text-center text-[10px] text-slate-500 leading-tight">
                            {file.file_name}
                          </span>
                        </a>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Lightbox ── */}
      {lightboxUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
          onClick={() => setLightboxUrl(null)}
        >
          <button
            className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20"
            onClick={() => setLightboxUrl(null)}
          >
            <X size={20} />
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={lightboxUrl}
            alt=""
            className="max-h-[90vh] max-w-[90vw] rounded-xl object-contain shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </>
  );
}
