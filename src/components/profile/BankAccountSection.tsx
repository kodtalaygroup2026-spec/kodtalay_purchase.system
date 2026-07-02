"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { CreditCard, Pencil, Check, X } from "lucide-react";
import {
  BANK_FORMATS,
  getBankFormat,
  getMaskPlaceholder,
  formatAccountInput,
  isAccountComplete,
  extractDigits,
} from "@/lib/utils/bankFormats";

interface BankAccountSectionProps {
  userId: string;
  initialBankName: string | null;
  initialBankAccount: string | null;
  initialHolderName: string | null;
}

export function BankAccountSection({
  userId,
  initialBankName,
  initialBankAccount,
  initialHolderName,
}: BankAccountSectionProps) {
  const supabase = createClient();

  const [editing, setEditing] = useState(false);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");

  // form state
  const [holderName, setHolderName] = useState(initialHolderName ?? "");
  const [bankName, setBankName] = useState(initialBankName ?? "");
  const [bankAccount, setBankAccount] = useState(initialBankAccount ?? "");

  // display state (committed after save)
  const [savedHolderName, setSavedHolderName] = useState(initialHolderName ?? "");
  const [savedBankName, setSavedBankName] = useState(initialBankName ?? "");
  const [savedBankAccount, setSavedBankAccount] = useState(initialBankAccount ?? "");

  const fmt = getBankFormat(bankName);
  const placeholder = fmt ? getMaskPlaceholder(fmt.mask) : "เลขที่บัญชี";
  const complete = bankName ? isAccountComplete(bankAccount, bankName) : bankAccount.trim().length > 0;
  const digitsLeft = fmt ? fmt.digits - extractDigits(bankAccount).length : 0;

  function handleAccountChange(raw: string) {
    setBankAccount(formatAccountInput(raw, bankName));
  }

  function handleBankChange(code: string) {
    setBankName(code);
    setBankAccount(""); // reset account เมื่อเปลี่ยนธนาคาร
  }

  async function handleSave() {
    if (!holderName.trim()) return;
    if (!complete) return;
    setStatus("saving");

    const { error } = await supabase
      .from("profiles")
      .update({
        bank_account_holder_name: holderName.trim() || null,
        bank_name: bankName || null,
        bank_account_number: bankAccount.trim() || null,
      })
      .eq("id", userId);

    if (error) {
      setStatus("error");
      setTimeout(() => setStatus("idle"), 3000);
    } else {
      setSavedHolderName(holderName.trim());
      setSavedBankName(bankName);
      setSavedBankAccount(bankAccount.trim());
      setEditing(false);
      setStatus("saved");
      setTimeout(() => setStatus("idle"), 2000);
    }
  }

  function handleCancel() {
    setHolderName(savedHolderName);
    setBankName(savedBankName);
    setBankAccount(savedBankAccount);
    setEditing(false);
  }

  const bankLabel = BANK_FORMATS.find((b) => b.code === savedBankName)?.label ?? savedBankName;

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CreditCard size={14} className="text-slate-400" />
          <span className="text-xs font-semibold text-slate-600">บัญชีธนาคาร</span>
        </div>
        {!editing && (
          <button
            onClick={() => setEditing(true)}
            className="flex items-center gap-1 rounded px-2 py-0.5 text-[11px] text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            <Pencil size={11} /> แก้ไข
          </button>
        )}
      </div>

      {editing ? (
        <div className="space-y-2">
          {/* ชื่อเจ้าของบัญชี */}
          <input
            value={holderName}
            onChange={(e) => setHolderName(e.target.value)}
            placeholder="ชื่อ-นามสกุล ตามหน้าบัญชี *"
            className={`w-full rounded-lg border px-3 py-1.5 text-sm focus:outline-none ${
              !holderName.trim() ? "border-red-300 focus:border-red-400" : "border-slate-300 focus:border-blue-500"
            }`}
          />

          {/* ธนาคาร */}
          <select
            value={bankName}
            onChange={(e) => handleBankChange(e.target.value)}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700 focus:border-blue-500 focus:outline-none"
          >
            <option value="">— เลือกธนาคาร —</option>
            {BANK_FORMATS.map((b) => (
              <option key={b.code} value={b.code}>{b.label}</option>
            ))}
          </select>

          {/* เลขบัญชี */}
          <div>
            <input
              value={bankAccount}
              onChange={(e) => handleAccountChange(e.target.value)}
              placeholder={placeholder}
              inputMode="numeric"
              className={`w-full rounded-lg border px-3 py-1.5 text-sm font-mono tracking-wider focus:outline-none ${
                bankAccount && !complete
                  ? "border-amber-400 focus:border-amber-500"
                  : "border-slate-300 focus:border-blue-500"
              }`}
            />
            {bankName && fmt && (
              <div className="mt-1 flex items-center justify-between text-[11px]">
                <span className="text-slate-400">รูปแบบ: {getMaskPlaceholder(fmt.mask)}</span>
                {!complete && (
                  <span className="text-amber-600">ต้องการอีก {digitsLeft} หลัก</span>
                )}
                {complete && (
                  <span className="text-green-600 font-medium">✓ ครบแล้ว</span>
                )}
              </div>
            )}
          </div>

          {/* ปุ่ม */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleSave}
              disabled={!complete || status === "saving"}
              className="flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:opacity-50"
            >
              <Check size={12} />
              {status === "saving" ? "กำลังบันทึก..." : "บันทึก"}
            </button>
            <button
              onClick={handleCancel}
              className="flex items-center gap-1 rounded-lg border border-slate-300 px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-50"
            >
              <X size={12} /> ยกเลิก
            </button>
          </div>

          {status === "error" && (
            <p className="text-xs text-red-500">เกิดข้อผิดพลาด กรุณาลองใหม่</p>
          )}
        </div>
      ) : savedBankName && savedBankAccount ? (
        <div className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 space-y-0.5">
          {savedHolderName && (
            <p className="text-sm font-semibold text-slate-800">{savedHolderName}</p>
          )}
          <p className="text-xs text-slate-500">{bankLabel}</p>
          <p className="font-mono text-sm font-medium text-slate-700 tracking-wider">
            {savedBankAccount}
          </p>
          {status === "saved" && (
            <p className="pt-1 text-[11px] text-green-600 font-medium">✓ บันทึกแล้ว</p>
          )}
        </div>
      ) : (
        <button
          onClick={() => setEditing(true)}
          className="w-full rounded-lg border border-dashed border-slate-300 py-2 text-xs text-slate-400 hover:border-blue-400 hover:bg-blue-50 hover:text-blue-500 transition-colors"
        >
          + เพิ่มบัญชีธนาคาร
        </button>
      )}
    </div>
  );
}
