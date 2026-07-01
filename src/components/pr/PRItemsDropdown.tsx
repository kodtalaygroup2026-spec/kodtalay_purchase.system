"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, ChevronUp, Pencil, Check, X } from "lucide-react";
import { formatCurrency } from "@/lib/utils/format";
import { createClient } from "@/lib/supabase/client";

interface PRItem {
  id: string;
  line_no: number;
  description: string;
  quantity: number;
  unit: string;
  unit_price: number;
  line_total: number | null;
  products: { name: string; unit: string; sku: string } | null;
}

interface PRItemsDropdownProps {
  items: PRItem[];
  totalAmount?: number; // ไม่ใช้ใน render แล้ว — คำนวณจาก items โดยตรง
  collapsible?: boolean;
  defaultOpen?: boolean;
  // edit mode — ใช้เฉพาะเมื่อ collapsible=true และ PR อนุมัติแล้ว
  editable?: boolean;
  prId?: string;
  currentUserId?: string;
}

// ── Shared table body (ใช้ซ้ำใน collapsible และ static mode) ──────────────
function ItemsTable({
  items,
  isEditing,
  editValues,
  onEdit,
}: {
  items: PRItem[];
  isEditing: boolean;
  editValues: Record<string, { quantity: string; unit_price: string }>;
  onEdit: (id: string, field: "quantity" | "unit_price", val: string) => void;
}) {
  return (
    <table className="min-w-full text-sm">
      <thead className="border-b border-slate-100 bg-slate-50">
        <tr>
          <th className="px-4 py-2 text-left font-medium text-slate-500">#</th>
          <th className="px-4 py-2 text-left font-medium text-slate-500">สินค้า</th>
          <th className="px-4 py-2 text-right font-medium text-slate-500">จำนวน</th>
          <th className="px-4 py-2 text-left font-medium text-slate-500">หน่วย</th>
          <th className="px-4 py-2 text-right font-medium text-slate-500">ราคา/หน่วย</th>
          <th className="px-4 py-2 text-right font-medium text-slate-500">รวม</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-100">
        {items.map((item) => {
          const ev = editValues[item.id] ?? { quantity: String(item.quantity), unit_price: String(item.unit_price) };
          const lineTotal = (parseFloat(ev.quantity) || 0) * (parseFloat(ev.unit_price) || 0);
          return (
            <tr key={item.id}>
              <td className="px-4 py-2 text-slate-400">{item.line_no}</td>
              <td className="px-4 py-2">
                <p className="font-medium text-slate-800">{item.description}</p>
                {item.products && <p className="text-xs text-slate-400">{item.products.sku}</p>}
              </td>
              <td className="px-4 py-2 text-right text-slate-700">
                {isEditing ? (
                  <input
                    type="text"
                    inputMode="decimal"
                    value={ev.quantity}
                    onChange={e => onEdit(item.id, "quantity", e.target.value)}
                    className="w-20 rounded border border-blue-300 px-2 py-1 text-right text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
                  />
                ) : (
                  Number(item.quantity).toLocaleString("th-TH", { maximumFractionDigits: 3 })
                )}
              </td>
              <td className="px-4 py-2 text-slate-500">{item.unit}</td>
              <td className="px-4 py-2 text-right text-slate-700">
                {isEditing ? (
                  <input
                    type="text"
                    inputMode="decimal"
                    value={ev.unit_price}
                    onChange={e => onEdit(item.id, "unit_price", e.target.value)}
                    className="w-24 rounded border border-blue-300 px-2 py-1 text-right text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
                  />
                ) : (
                  formatCurrency(item.unit_price)
                )}
              </td>
              <td className="px-4 py-2 text-right font-medium text-slate-800">
                {formatCurrency(isEditing ? lineTotal : (item.line_total ?? item.quantity * item.unit_price))}
              </td>
            </tr>
          );
        })}
      </tbody>
      <tfoot className="border-t border-slate-200 bg-slate-50">
        <tr>
          <td colSpan={5} className="px-4 py-3 text-right font-semibold text-slate-700">
            รวมทั้งสิ้น
          </td>
          <td className="px-4 py-3 text-right font-bold text-slate-900">
            {formatCurrency(
              isEditing
                ? items.reduce((s, it) => {
                    const ev = editValues[it.id] ?? { quantity: String(it.quantity), unit_price: String(it.unit_price) };
                    return s + (parseFloat(ev.quantity) || 0) * (parseFloat(ev.unit_price) || 0);
                  }, 0)
                : items.reduce((s, it) => s + (it.line_total ?? it.quantity * it.unit_price), 0)
            )}
          </td>
        </tr>
      </tfoot>
    </table>
  );
}

// ── Main component ──────────────────────────────────────────────────────────

export function PRItemsDropdown({
  items,
  collapsible = true,
  defaultOpen = false,
  editable = false,
  prId,
  currentUserId,
}: PRItemsDropdownProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editValues, setEditValues] = useState<Record<string, { quantity: string; unit_price: string }>>({});
  const [saveError, setSaveError] = useState<string | null>(null);

  function startEditing() {
    const init: Record<string, { quantity: string; unit_price: string }> = {};
    items.forEach(it => { init[it.id] = { quantity: String(it.quantity), unit_price: String(it.unit_price) }; });
    setEditValues(init);
    setIsEditing(true);
    setIsOpen(true);
  }

  function cancelEditing() {
    setIsEditing(false);
    setEditValues({});
    setSaveError(null);
  }

  function handleEdit(id: string, field: "quantity" | "unit_price", val: string) {
    setEditValues(prev => ({
      ...prev,
      [id]: { ...(prev[id] ?? { quantity: "0", unit_price: "0" }), [field]: val },
    }));
  }

  async function handleSave() {
    if (!prId || !currentUserId) return;
    setIsSaving(true);
    setSaveError(null);

    try {
      const supabase = createClient();

      // คำนวณ diff
      const changes: object[] = [];
      for (const item of items) {
        const ev = editValues[item.id];
        if (!ev) continue;
        const newQty = parseFloat(ev.quantity) || 0;
        const newPrice = parseFloat(ev.unit_price) || 0;
        const qChanged = newQty !== item.quantity;
        const pChanged = newPrice !== item.unit_price;
        if (!qChanged && !pChanged) continue;

        changes.push({
          item_id: item.id,
          description: item.description,
          quantity_old: item.quantity,
          quantity_new: newQty,
          unit_price_old: item.unit_price,
          unit_price_new: newPrice,
        });

        await supabase
          .from("pr_items")
          .update({ quantity: newQty, unit_price: newPrice })
          .eq("id", item.id);
      }

      if (changes.length > 0) {
        const newTotal = items.reduce((s, it) => {
          const ev = editValues[it.id] ?? { quantity: String(it.quantity), unit_price: String(it.unit_price) };
          return s + (parseFloat(ev.quantity) || 0) * (parseFloat(ev.unit_price) || 0);
        }, 0);

        await (supabase as any)
          .from("purchase_requisitions")
          .update({ total_amount: newTotal })
          .eq("id", prId);

        await (supabase as any)
          .from("pr_item_edit_logs")
          .insert({ pr_id: prId, edited_by: currentUserId, changes });
      }

      setIsEditing(false);
      setEditValues({});
      router.refresh();
    } catch (err: unknown) {
      setSaveError((err as Error).message ?? "บันทึกไม่สำเร็จ");
    } finally {
      setIsSaving(false);
    }
  }

  // ── non-collapsible (ขั้นตอน 1-2): static table ──────────────────────────
  if (!collapsible) {
    return (
      <div>
        <div className="border-t border-slate-100 px-6 py-3">
          <h3 className="font-semibold text-slate-700">รายการสินค้า</h3>
        </div>
        <ItemsTable items={items} isEditing={false} editValues={{}} onEdit={() => {}} />
      </div>
    );
  }

  // ── collapsible (ขั้นตอน 3): dropdown + optional edit ────────────────────

  // คำนวณจาก pr_items จริงๆ เสมอ (ไม่ใช้ totalAmount prop ที่อาจ stale)
  const computedTotal = items.reduce(
    (s, it) => s + (it.line_total ?? it.quantity * it.unit_price),
    0
  );

  return (
    <div>
      {/* Header bar */}
      <div className="flex items-center border-t border-slate-100">
        <button
          type="button"
          onClick={() => !isEditing && setIsOpen(o => !o)}
          className="flex flex-1 items-center justify-between px-6 py-3 text-left transition-colors hover:bg-slate-50"
        >
          <h3 className="font-semibold text-slate-700">รายการสินค้า</h3>
          <div className="flex items-center gap-2">
            {!isOpen && !isEditing && (
              <span className="text-sm font-semibold text-slate-600">{formatCurrency(computedTotal)}</span>
            )}
            {isOpen
              ? <ChevronUp size={15} className="text-slate-400" />
              : <ChevronDown size={15} className="text-slate-400" />
            }
          </div>
        </button>

        {/* ปุ่มแก้ไข — แสดงเฉพาะเมื่อ editable=true */}
        {editable && !isEditing && (
          <button
            type="button"
            onClick={startEditing}
            className="mr-4 flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-600 transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700"
          >
            <Pencil size={12} /> แก้ไข
          </button>
        )}

        {/* ปุ่มบันทึก/ยกเลิก เมื่ออยู่ใน edit mode */}
        {isEditing && (
          <div className="mr-4 flex items-center gap-2">
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving}
              className="flex items-center gap-1 rounded-lg bg-blue-600 px-2.5 py-1.5 text-xs font-medium text-white transition hover:bg-blue-700 disabled:opacity-60"
            >
              <Check size={12} /> {isSaving ? "กำลังบันทึก..." : "บันทึก"}
            </button>
            <button
              type="button"
              onClick={cancelEditing}
              disabled={isSaving}
              className="flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-500 hover:bg-slate-50"
            >
              <X size={12} /> ยกเลิก
            </button>
          </div>
        )}
      </div>

      {/* Error message */}
      {saveError && (
        <p className="border-t border-red-100 bg-red-50 px-6 py-2 text-xs text-red-600">{saveError}</p>
      )}

      {/* Expanded table */}
      {isOpen && (
        <ItemsTable
          items={items}
          isEditing={isEditing}
          editValues={editValues}
          onEdit={handleEdit}
        />
      )}
    </div>
  );
}
