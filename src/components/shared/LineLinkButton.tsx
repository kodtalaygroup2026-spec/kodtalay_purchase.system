"use client";
import { useState } from "react";
import { MessageSquare, Check, Copy, X } from "lucide-react";

interface LineLinkButtonProps {
  isLinked: boolean;
}

export function LineLinkButton({ isLinked }: LineLinkButtonProps) {
  const [code, setCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  async function handleGetCode() {
    setLoading(true);
    try {
      const res = await fetch("/api/line/otp", { method: "POST" });
      const data = await res.json() as { code?: string };
      if (data.code) setCode(data.code);
    } catch {
      // ไม่แสดง error ดิบ
    } finally {
      setLoading(false);
    }
  }

  async function handleCopy() {
    if (!code) return;
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (isLinked) {
    return (
      <div className="flex items-center gap-1.5 rounded-full bg-green-50 px-3 py-1 text-xs font-medium text-green-700">
        <Check size={12} />
        เชื่อม LINE แล้ว
      </div>
    );
  }

  if (code) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-3 py-1.5">
        <MessageSquare size={14} className="shrink-0 text-green-600" />
        <div className="text-xs">
          <p className="text-slate-600">ส่งรหัสนี้ให้ OA ใน LINE:</p>
          <p className="font-mono text-base font-bold tracking-widest text-green-700">{code}</p>
          <p className="text-[10px] text-slate-400">หมดอายุใน 10 นาที</p>
        </div>
        <button
          onClick={handleCopy}
          className="rounded p-1 text-slate-400 hover:text-slate-700"
          title="คัดลอกรหัส"
        >
          {copied ? <Check size={14} className="text-green-600" /> : <Copy size={14} />}
        </button>
        <button
          onClick={() => setCode(null)}
          className="rounded p-1 text-slate-400 hover:text-slate-700"
          title="ปิด"
        >
          <X size={14} />
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={handleGetCode}
      disabled={loading}
      className="flex items-center gap-1.5 rounded-full border border-green-300 bg-white px-3 py-1 text-xs font-medium text-green-700 transition-colors hover:bg-green-50 disabled:opacity-50"
    >
      <MessageSquare size={12} />
      {loading ? "กำลังสร้างรหัส…" : "เชื่อม LINE"}
    </button>
  );
}
