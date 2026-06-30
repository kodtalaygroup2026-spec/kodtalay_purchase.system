"use client";

import { useState, useRef, useEffect } from "react";
import { X, Package, ChevronDown } from "lucide-react";
import { formatCurrency } from "@/lib/utils/format";

interface ProductOption {
  id: string;
  sku: string;
  name: string;
  unit: string;
  unit_price: number;
}

interface ProductSearchInputProps {
  value: string;
  products: ProductOption[];
  selectedProductId: string;
  onChange: (description: string) => void;
  onSelectProduct: (product: ProductOption) => void;
  onClearProduct: () => void;
  placeholder?: string;
}

export function ProductSearchInput({
  value,
  products,
  selectedProductId,
  onChange,
  onSelectProduct,
  onClearProduct,
  placeholder = "พิมพ์ชื่อสินค้า หรือเลือกจากรายการ...",
}: ProductSearchInputProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // กรองรายการตามข้อความที่พิมพ์ (ถ้ายังไม่ได้เลือก product ให้กรองด้วย value)
  const query = selectedProductId ? "" : value;
  const filteredProducts = query.trim()
    ? products.filter(
        (p) =>
          p.name.toLowerCase().includes(query.toLowerCase()) ||
          p.sku.toLowerCase().includes(query.toLowerCase())
      )
    : products;

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value;
    onChange(val);
    if (!open) setOpen(true);
    // ถ้าผู้ใช้แก้ข้อความหลังจากเลือก product แล้ว → เคลียร์การเลือก
    if (selectedProductId) onClearProduct();
  }

  function handleFocus() {
    setOpen(true);
  }

  function handleSelect(product: ProductOption) {
    onSelectProduct(product);
    onChange(product.name);
    setOpen(false);
  }

  function handleClear(e: React.MouseEvent) {
    e.stopPropagation();
    onClearProduct();
    onChange("");
    inputRef.current?.focus();
    setOpen(true);
  }

  return (
    <div className="relative flex-1" ref={containerRef}>
      {/* Input เดียว */}
      <div
        className={`flex items-center rounded-lg border bg-white transition-colors ${
          open ? "border-blue-400 ring-2 ring-blue-100" : "border-slate-300"
        }`}
      >
        <input
          ref={inputRef}
          value={value}
          onChange={handleInputChange}
          onFocus={handleFocus}
          placeholder={placeholder}
          required
          className="flex-1 bg-transparent px-3 py-2 text-sm focus:outline-none"
        />

        {selectedProductId ? (
          <button
            type="button"
            onClick={handleClear}
            title="ล้างการเลือก"
            className="mr-1.5 rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            <X size={13} />
          </button>
        ) : (
          <button
            type="button"
            onClick={() => {
              setOpen((o) => !o);
              inputRef.current?.focus();
            }}
            className="mr-1.5 rounded p-1 text-slate-400 hover:bg-slate-100"
          >
            <ChevronDown
              size={13}
              className={`transition-transform ${open ? "rotate-180" : ""}`}
            />
          </button>
        )}
      </div>

      {/* Dropdown */}
      {open && (
        <div className="absolute left-0 top-full z-30 mt-1 w-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">
          <div className="max-h-60 overflow-y-auto">
            {filteredProducts.length === 0 ? (
              <div className="py-6 text-center">
                <Package size={18} className="mx-auto mb-1.5 text-slate-300" />
                <p className="text-xs text-slate-400">ไม่พบสินค้าที่ค้นหา</p>
              </div>
            ) : (
              filteredProducts.map((product) => {
                const isSelected = product.id === selectedProductId;
                return (
                  <button
                    key={product.id}
                    type="button"
                    onClick={() => handleSelect(product)}
                    className={`flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-blue-50 ${
                      isSelected ? "bg-blue-50" : ""
                    }`}
                  >
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-100">
                      <Package size={13} className="text-slate-500" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p
                        className={`truncate text-sm font-medium ${
                          isSelected ? "text-blue-700" : "text-slate-800"
                        }`}
                      >
                        {product.name}
                      </p>
                      <p className="text-[10px] text-slate-400">
                        SKU: {product.sku} · {product.unit}
                      </p>
                    </div>
                    <span
                      className={`shrink-0 text-sm font-semibold ${
                        isSelected ? "text-blue-600" : "text-slate-600"
                      }`}
                    >
                      {formatCurrency(product.unit_price)}
                    </span>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
