"use client";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { MessageCircle, Link2, Unlink2, Copy, Check } from "lucide-react";

interface LineLinkButtonProps {
  userId: string;
  initialLineUserId: string | null;
}

export function LineLinkButton({ userId, initialLineUserId }: LineLinkButtonProps) {
  const supabase = createClient();
  const [lineUserId, setLineUserId] = useState(initialLineUserId);
  const [code, setCode] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleGenerateCode() {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/line/link-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setCode(data.code);
    } catch (err) {
      setError(err instanceof Error ? err.message : "เกิดข้อผิดพลาด");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleUnlink() {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/line/link-code", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error);
      }
      setLineUserId(null);
      setCode(null);
      // อัปเดต session cache ฝั่ง client
      await supabase.from("profiles").select("line_user_id").eq("id", userId).single();
    } catch (err) {
      setError(err instanceof Error ? err.message : "เกิดข้อผิดพลาด");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleCopy() {
    if (!code) return;
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-green-100">
          <MessageCircle size={18} className="text-green-600" />
        </div>
        <div>
          <h3 className="font-semibold text-slate-800">การแจ้งเตือนผ่าน LINE</h3>
          <p className="text-xs text-slate-500">เชื่อมบัญชีเพื่อรับแจ้งเตือนสถานะใบขอซื้อ</p>
        </div>
      </div>

      {lineUserId ? (
        <div className="space-y-3">
          <div className="flex items-center gap-2 rounded-lg bg-green-50 px-4 py-3 text-sm font-medium text-green-700">
            <Link2 size={15} />
            เชื่อม LINE เรียบร้อยแล้ว
          </div>
          <button
            onClick={handleUnlink}
            disabled={isLoading}
            className="flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-600 transition hover:bg-slate-50 disabled:opacity-60"
          >
            <Unlink2 size={15} />
            {isLoading ? "กำลังยกเลิก..." : "ยกเลิกการเชื่อม LINE"}
          </button>
        </div>
      ) : code ? (
        <div className="space-y-3">
          <p className="text-sm text-slate-600">
            ส่งรหัสนี้ให้ LINE Bot ของระบบเพื่อเชื่อมบัญชี (หมดอายุใน 10 นาที)
          </p>
          <div className="flex items-center gap-2">
            <div className="flex-1 rounded-lg bg-slate-100 px-4 py-3 text-center text-2xl font-bold tracking-[0.3em] text-slate-800">
              {code}
            </div>
            <button
              onClick={handleCopy}
              className="rounded-lg border border-slate-300 p-3 text-slate-600 transition hover:bg-slate-50"
              title="คัดลอกรหัส"
            >
              {copied ? <Check size={16} className="text-green-600" /> : <Copy size={16} />}
            </button>
          </div>
          <p className="text-xs text-slate-400">
            เมื่อส่งรหัสสำเร็จ หน้านี้จะแสดงว่าเชื่อมแล้วในการเข้าใช้ครั้งถัดไป
          </p>
          <button
            onClick={handleGenerateCode}
            disabled={isLoading}
            className="text-sm text-blue-600 hover:underline disabled:opacity-60"
          >
            ขอรหัสใหม่
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-slate-600">ยังไม่ได้เชื่อม LINE — คลิกเพื่อรับรหัสเชื่อมบัญชี</p>
          <button
            onClick={handleGenerateCode}
            disabled={isLoading}
            className="flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-green-700 disabled:opacity-60"
          >
            <Link2 size={15} />
            {isLoading ? "กำลังสร้างรหัส..." : "เชื่อม LINE"}
          </button>
        </div>
      )}

      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
    </div>
  );
}
