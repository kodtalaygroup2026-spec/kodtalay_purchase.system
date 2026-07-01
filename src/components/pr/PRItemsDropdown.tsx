"use client";
import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { formatCurrency } from "@/lib/utils/format";

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
  totalAmount: number;
  defaultOpen?: boolean;
}

export function PRItemsDropdown({ items, totalAmount, defaultOpen = false }: PRItemsDropdownProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div>
      <button
        type="button"
        onClick={() => setIsOpen(o => !o)}
        className="flex w-full items-center justify-between border-t border-slate-100 px-6 py-3 text-left transition-colors hover:bg-slate-50"
      >
        <h3 className="font-semibold text-slate-700">รายการสินค้า</h3>
        <div className="flex items-center gap-2">
          {!isOpen && (
            <span className="text-sm font-semibold text-slate-600">{formatCurrency(totalAmount)}</span>
          )}
          {isOpen
            ? <ChevronUp size={15} className="text-slate-400" />
            : <ChevronDown size={15} className="text-slate-400" />
          }
        </div>
      </button>

      {isOpen && (
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
            {items.map((item) => (
              <tr key={item.id}>
                <td className="px-4 py-2 text-slate-400">{item.line_no}</td>
                <td className="px-4 py-2">
                  <p className="font-medium text-slate-800">{item.description}</p>
                  {item.products && <p className="text-xs text-slate-400">{item.products.sku}</p>}
                </td>
                <td className="px-4 py-2 text-right text-slate-700">
                  {Number(item.quantity).toLocaleString("th-TH")}
                </td>
                <td className="px-4 py-2 text-slate-500">{item.unit}</td>
                <td className="px-4 py-2 text-right text-slate-700">
                  {formatCurrency(item.unit_price)}
                </td>
                <td className="px-4 py-2 text-right font-medium text-slate-800">
                  {formatCurrency(item.line_total ?? item.quantity * item.unit_price)}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot className="border-t border-slate-200 bg-slate-50">
            <tr>
              <td colSpan={5} className="px-4 py-3 text-right font-semibold text-slate-700">
                รวมทั้งสิ้น
              </td>
              <td className="px-4 py-3 text-right font-bold text-slate-900">
                {formatCurrency(totalAmount)}
              </td>
            </tr>
          </tfoot>
        </table>
      )}
    </div>
  );
}
