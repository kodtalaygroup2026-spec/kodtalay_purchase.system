"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import { createExpense } from "@/lib/expense/actions";
import { formatCurrency } from "@/lib/utils/format";
import type { Branch } from "@/types/database";

interface ItemRow {
  id: string;
  description: string;
  amount: string;
}

interface ExpenseFormProps {
  branches: Branch[];
  defaultBranchId?: string;
}

export function ExpenseForm({ branches, defaultBranchId }: ExpenseFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [branchId, setBranchId] = useState(defaultBranchId ?? branches[0]?.id ?? "");
  const [requestDate, setRequestDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [note, setNote] = useState("");
  const [items, setItems] = useState<ItemRow[]>([
    { id: crypto.randomUUID(), description: "", amount: "" },
  ]);

  function addItem() {
    setItems((prev) => [
      ...prev,
      { id: crypto.randomUUID(), description: "", amount: "" },
    ]);
  }

  function removeItem(id: string) {
    setItems((prev) => prev.filter((item) => item.id !== id));
  }

  function updateItem(id: string, field: "description" | "amount", value: string) {
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, [field]: value } : item))
    );
  }

  const totalAmount = items.reduce((sum, item) => {
    const amt = parseFloat(item.amount) || 0;
    return sum + amt;
  }, 0);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const validItems = items.filter(
      (item) => item.description.trim() && parseFloat(item.amount) > 0
    );
    if (!title.trim()) {
      setError("กรุณากรอกชื่อเรื่อง");
      return;
    }
    if (validItems.length === 0) {
      setError("กรุณาเพิ่มรายการอย่างน้อย 1 รายการ");
      return;
    }

    startTransition(async () => {
      try {
        const expenseId = await createExpense({
          title: title.trim(),
          branch_id: branchId,
          request_date: requestDate,
          note: note.trim() || undefined,
          items: validItems.map((item) => ({
            description: item.description.trim(),
            amount: parseFloat(item.amount),
          })),
        });
        router.push(`/expenses/${expenseId}`);
      } catch (err) {
        setError(err instanceof Error ? err.message : "เกิดข้อผิดพลาด");
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* ข้อมูลหลัก */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="mb-4 text-sm font-semibold text-slate-700">ข้อมูลใบเบิก</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="mb-1 block text-xs font-medium text-slate-600">
              ชื่อเรื่อง / วัตถุประสงค์ <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="เช่น ค่าวัสดุสำนักงานประจำเดือน"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
              required
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">
              สาขา <span className="text-red-500">*</span>
            </label>
            <select
              value={branchId}
              onChange={(e) => setBranchId(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
              required
            >
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">
              วันที่เบิก <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              value={requestDate}
              onChange={(e) => setRequestDate(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
              required
            />
          </div>

          <div className="sm:col-span-2">
            <label className="mb-1 block text-xs font-medium text-slate-600">
              หมายเหตุ
            </label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              placeholder="หมายเหตุเพิ่มเติม (ถ้ามี)"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
            />
          </div>
        </div>
      </div>

      {/* รายการ */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-700">รายการค่าใช้จ่าย</h2>
          <button
            type="button"
            onClick={addItem}
            className="flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700"
          >
            <Plus size={14} />
            เพิ่มรายการ
          </button>
        </div>

        <div className="space-y-2">
          {items.map((item, index) => (
            <div key={item.id} className="flex items-center gap-2">
              <span className="w-6 shrink-0 text-center text-xs text-slate-400">
                {index + 1}
              </span>
              <input
                type="text"
                value={item.description}
                onChange={(e) => updateItem(item.id, "description", e.target.value)}
                placeholder="รายละเอียด"
                className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
              />
              <input
                type="number"
                value={item.amount}
                onChange={(e) => updateItem(item.id, "amount", e.target.value)}
                placeholder="จำนวนเงิน"
                min="0"
                step="0.01"
                className="w-32 rounded-lg border border-slate-200 px-3 py-2 text-right text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
              />
              <button
                type="button"
                onClick={() => removeItem(item.id)}
                disabled={items.length === 1}
                className="shrink-0 rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-500 disabled:opacity-30"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>

        {/* ยอดรวม */}
        <div className="mt-4 flex justify-end border-t border-slate-100 pt-3">
          <div className="text-right">
            <p className="text-xs text-slate-500">ยอดรวมทั้งหมด</p>
            <p className="text-lg font-bold text-slate-800">{formatCurrency(totalAmount)}</p>
          </div>
        </div>
      </div>

      {/* ปุ่ม */}
      <div className="flex justify-end gap-3">
        <button
          type="button"
          onClick={() => router.back()}
          className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50"
        >
          ยกเลิก
        </button>
        <button
          type="submit"
          disabled={isPending}
          className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
        >
          {isPending ? "กำลังบันทึก..." : "บันทึกใบเบิก"}
        </button>
      </div>
    </form>
  );
}
