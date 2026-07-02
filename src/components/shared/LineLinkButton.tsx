"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { MessageCircle, Link2, Unlink2, Copy, Check, RefreshCw } from "lucide-react";

const CODE_TTL_SECONDS = 10 * 60; // 10 นาที ตรงกับ DB expires_at

interface LineLinkButtonProps {
  userId: string;
  initialLineUserId: string | null;
  compact?: boolean; // เมื่อ true: ไม่มี card wrapper
}

export function LineLinkButton({ userId, initialLineUserId, compact = false }: LineLinkButtonProps) {
  const supabase = createClient();
  const [lineUserId, setLineUserId] = useState(initialLineUserId);
  const [code, setCode] = useState<string | null>(null);
  const [codeExpired, setCodeExpired] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // เริ่ม / หยุด countdown
  const startCountdown = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    setCodeExpired(false);
    setSecondsLeft(CODE_TTL_SECONDS);
    timerRef.current = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current!);
          timerRef.current = null;
          setCode(null);
          setCodeExpired(true); // บอกว่าเคยมี code แต่หมดอายุแล้ว
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, []);

  // clear timer เมื่อ unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  function formatTime(s: number): string {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, "0")}`;
  }

  // สีของ countdown ตามเวลาเหลือ
  function timerColor(): string {
    if (secondsLeft > 120) return "text-green-600";
    if (secondsLeft > 30) return "text-yellow-600";
    return "text-red-600";
  }

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
      startCountdown();
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
      setCodeExpired(false);
      if (timerRef.current) clearInterval(timerRef.current);
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

  const inner = (
    <div>
      <div className="mb-3 flex items-center gap-2">
        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-green-100">
          <MessageCircle size={14} className="text-green-600" />
        </div>
        <div>
          <p className="text-xs font-semibold text-slate-600">การแจ้งเตือนผ่าน LINE</p>
          <p className="text-[11px] text-slate-400">เชื่อมบัญชีเพื่อรับแจ้งเตือนสถานะใบขอซื้อ</p>
        </div>
      </div>

      {lineUserId ? (
        /* ── เชื่อมแล้ว ── */
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
        /* ── แสดง code + countdown ── */
        <div className="space-y-3">
          <p className="text-sm text-slate-600">
            ส่งรหัสนี้ให้ LINE Bot ของระบบเพื่อเชื่อมบัญชี
          </p>

          {/* ตัวรหัส + ปุ่ม copy */}
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

          {/* countdown bar */}
          <div className="space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400">หมดอายุใน</span>
              <span className={`font-semibold tabular-nums ${timerColor()}`}>
                {formatTime(secondsLeft)}
              </span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
              <div
                className={`h-full rounded-full transition-all duration-1000 ${
                  secondsLeft > 120
                    ? "bg-green-500"
                    : secondsLeft > 30
                    ? "bg-yellow-500"
                    : "bg-red-500"
                }`}
                style={{ width: `${(secondsLeft / CODE_TTL_SECONDS) * 100}%` }}
              />
            </div>
          </div>

          <p className="text-xs text-slate-400">
            เมื่อส่งรหัสสำเร็จ หน้านี้จะแสดงว่าเชื่อมแล้วในการเข้าใช้ครั้งถัดไป
          </p>

          <button
            onClick={handleGenerateCode}
            disabled={isLoading}
            className="flex items-center gap-1.5 text-sm text-blue-600 hover:underline disabled:opacity-60"
          >
            <RefreshCw size={13} />
            ขอรหัสใหม่
          </button>
        </div>
      ) : codeExpired ? (
        /* ── รหัสหมดอายุ → ขอใหม่ ── */
        <div className="space-y-3">
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            รหัสหมดอายุแล้ว กรุณาขอรหัสใหม่
          </div>
          <button
            onClick={handleGenerateCode}
            disabled={isLoading}
            className="flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-green-700 disabled:opacity-60"
          >
            <RefreshCw size={15} />
            {isLoading ? "กำลังสร้างรหัส..." : "ขอรหัสใหม่"}
          </button>
        </div>
      ) : (
        /* ── ยังไม่เชื่อม ── */
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

      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
    </div>
  );

  if (compact) return inner;
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">{inner}</div>
  );
}
