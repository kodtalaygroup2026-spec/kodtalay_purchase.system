"use client";

import { useState } from "react";
import { FileText, Lock, Paperclip, X, ZoomIn } from "lucide-react";

export interface PRAttachment {
  id: string;
  file_name: string;
  file_url: string;
  file_type: string | null;   // 'image' | 'pdf'
  file_size: number | null;
}

function formatFileSize(bytes: number | null): string {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function isImage(a: PRAttachment) {
  return a.file_type === "image" || /\.(jpg|jpeg|png|webp|gif)$/i.test(a.file_name);
}

export function PRAttachmentsSection({
  attachments,
  locked = false,
}: {
  attachments: PRAttachment[];
  /** true = ใบถูกตีกลับจากการเงิน แสดงป้ายอ่านอย่างเดียว */
  locked?: boolean;
}) {
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  if (attachments.length === 0) return null;

  return (
    <>
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-3 flex items-center gap-2">
          <Paperclip size={16} className="text-slate-400" />
          <h3 className="font-semibold text-slate-700">ใบเสนอราคา</h3>
          <span className="text-xs text-slate-400">({attachments.length} ไฟล์)</span>
          {locked && (
            <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-500">
              <Lock size={10} /> อ่านอย่างเดียว
            </span>
          )}
        </div>

        <div className="flex flex-wrap gap-3">
          {attachments.map((a) =>
            isImage(a) ? (
              <button
                key={a.id}
                type="button"
                onClick={() => setLightboxUrl(a.file_url)}
                title={a.file_name}
                className="group flex flex-col items-center gap-1.5"
              >
                <div className="relative h-28 w-28 overflow-hidden rounded-xl border border-slate-200 bg-slate-100 shadow-sm transition-all duration-200 group-hover:shadow-lg group-hover:ring-2 group-hover:ring-blue-400 group-hover:ring-offset-2">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={a.file_url}
                    alt={a.file_name}
                    className="h-full w-full object-cover transition duration-200 group-hover:scale-105"
                  />
                  <span className="absolute inset-0 flex items-center justify-center bg-black/0 transition group-hover:bg-black/25">
                    <ZoomIn size={18} className="text-white opacity-0 drop-shadow transition group-hover:opacity-100" />
                  </span>
                </div>
                <span className="max-w-[7rem] truncate text-center text-[10px] text-slate-400">{a.file_name}</span>
              </button>
            ) : (
              <a
                key={a.id}
                href={a.file_url}
                target="_blank"
                rel="noopener noreferrer"
                title={a.file_name}
                className="group flex flex-col items-center gap-1.5"
              >
                <div className="flex h-28 w-28 flex-col items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-50 shadow-sm transition-all duration-200 group-hover:border-red-300 group-hover:bg-red-50 group-hover:shadow-lg">
                  <FileText size={28} className="text-red-400 transition group-hover:text-red-500" />
                  <span className="line-clamp-2 px-2 text-center text-[9px] leading-tight text-slate-500">
                    {a.file_name}
                  </span>
                </div>
                <span className="text-[10px] text-slate-400">{formatFileSize(a.file_size)}</span>
              </a>
            )
          )}
        </div>
      </div>

      {/* Lightbox */}
      {lightboxUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
          onClick={() => setLightboxUrl(null)}
        >
          <button
            type="button"
            className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full bg-white/15 text-white transition hover:bg-white/25"
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
