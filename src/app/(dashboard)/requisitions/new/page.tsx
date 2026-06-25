"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import { ArrowLeft, Plus, Trash2 } from "lucide-react";

interface Product {
  id: string;
  name: string;
  sku: string;
  unit: string;
  unit_price: number;
}

interface PRItem {
  product_id: string;
  product_name: string;
  unit: string;
  quantity: number;
  unit_price: number;
}

export default function NewRequisitionPage() {
  const router = useRouter();
  const supabase = createClient();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [items, setItems] = useState<PRItem[]>([
    { product_id: "", product_name: "", unit: "", quantity: 1, unit_price: 0 },
  ]);

  useEffect(() => {
    supabase
      .from("products")
      .select("id, name, sku, unit, unit_price")
      .eq("is_active", true)
      .order("name")
      .then(({ data }) => setProducts(data ?? []));
  }, [supabase]);

  function addItem() {
    setItems((prev) => [
      ...prev,
      { product_id: "", product_name: "", unit: "", quantity: 1, unit_price: 0 },
    ]);
  }

  function removeItem(index: number) {
    setItems((prev) => prev.filter((_, i) => i !== index));
  }

  function updateItem(index: number, field: keyof PRItem, value: string | number) {
    setItems((prev) =>
      prev.map((item, i) => {
        if (i !== index) return item;
        const updated = { ...item, [field]: value };

        if (field === "product_id") {
          const selectedProduct = products.find((p) => p.id === value);
          if (selectedProduct) {
            updated.product_name = selectedProduct.name;
            updated.unit = selectedProduct.unit;
            updated.unit_price = selectedProduct.unit_price;
          }
        }
        return updated;
      })
    );
  }

  const totalAmount = items.reduce(
    (sum, item) => sum + item.quantity * item.unit_price,
    0
  );

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setErrorMessage(null);

    if (items.some((item) => !item.product_id)) {
      setErrorMessage("กรุณาเลือกสินค้าให้ครบทุกรายการ");
      setIsSubmitting(false);
      return;
    }

    const formData = new FormData(event.currentTarget);

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setErrorMessage("กรุณาล็อกอินก่อน");
      setIsSubmitting(false);
      return;
    }

    // สร้าง PR number ผ่าน RPC
    const { data: prNumber, error: rpcError } = await supabase.rpc(
      "next_document_number",
      { prefix: "PR", table_name: "purchase_requisitions", column_name: "pr_number" }
    );

    if (rpcError) {
      setErrorMessage(rpcError.message);
      setIsSubmitting(false);
      return;
    }

    const { data: pr, error: prError } = await supabase
      .from("purchase_requisitions")
      .insert({
        pr_number: prNumber,
        title: formData.get("title") as string,
        requester_id: user.id,
        department: (formData.get("department") as string) || null,
        needed_by: (formData.get("needed_by") as string) || null,
        note: (formData.get("note") as string) || null,
        status: "draft",
      })
      .select("id")
      .single();

    if (prError || !pr) {
      setErrorMessage(prError?.message ?? "เกิดข้อผิดพลาด");
      setIsSubmitting(false);
      return;
    }

    const prItems = items.map((item, i) => ({
      pr_id: pr.id,
      line_no: i + 1,
      product_id: item.product_id || null,
      description: item.product_name,
      quantity: item.quantity,
      unit: item.unit,
      unit_price: item.unit_price,
    }));

    const { error: itemsError } = await supabase.from("pr_items").insert(prItems);

    if (itemsError) {
      setErrorMessage(itemsError.message);
      setIsSubmitting(false);
      return;
    }

    router.push(`/requisitions/${pr.id}`);
    router.refresh();
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div className="flex items-center gap-3">
        <Link href="/requisitions" className="text-slate-400 hover:text-slate-600">
          <ArrowLeft size={20} />
        </Link>
        <h1 className="text-xl font-bold text-slate-800">สร้างใบขอซื้อใหม่</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* ข้อมูลหลัก */}
        <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="font-semibold text-slate-700">ข้อมูลทั่วไป</h2>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              ชื่อ/เรื่อง <span className="text-red-500">*</span>
            </label>
            <input
              name="title"
              required
              placeholder="เช่น ขอซื้อกระดาษ A4 ประจำไตรมาส Q3"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                แผนก
              </label>
              <input
                name="department"
                placeholder="เช่น บัญชี, ไอที, ทั่วไป"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                วันที่ต้องการ
              </label>
              <input
                name="needed_by"
                type="date"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              หมายเหตุ
            </label>
            <textarea
              name="note"
              rows={2}
              placeholder="รายละเอียดเพิ่มเติม"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            />
          </div>
        </div>

        {/* รายการสินค้า */}
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
            <h2 className="font-semibold text-slate-700">รายการสินค้า</h2>
            <button
              type="button"
              onClick={addItem}
              className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800"
            >
              <Plus size={15} /> เพิ่มรายการ
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="border-b border-slate-100 bg-slate-50">
                <tr>
                  <th className="px-4 py-2 text-left font-medium text-slate-500 w-8">#</th>
                  <th className="px-4 py-2 text-left font-medium text-slate-500">สินค้า</th>
                  <th className="px-4 py-2 text-right font-medium text-slate-500 w-24">จำนวน</th>
                  <th className="px-4 py-2 text-left font-medium text-slate-500 w-20">หน่วย</th>
                  <th className="px-4 py-2 text-right font-medium text-slate-500 w-28">ราคา/หน่วย</th>
                  <th className="px-4 py-2 text-right font-medium text-slate-500 w-28">รวม</th>
                  <th className="px-4 py-2 w-10"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {items.map((item, index) => (
                  <tr key={index}>
                    <td className="px-4 py-2 text-slate-400">{index + 1}</td>
                    <td className="px-4 py-2">
                      <select
                        value={item.product_id}
                        onChange={(e) => updateItem(index, "product_id", e.target.value)}
                        className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
                      >
                        <option value="">— เลือกสินค้า —</option>
                        {products.map((p) => (
                          <option key={p.id} value={p.id}>
                            [{p.sku}] {p.name}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-2">
                      <input
                        type="number"
                        min="1"
                        step="1"
                        value={item.quantity}
                        onChange={(e) =>
                          updateItem(index, "quantity", parseFloat(e.target.value) || 1)
                        }
                        className="w-full rounded border border-slate-300 px-2 py-1.5 text-right text-sm focus:border-blue-500 focus:outline-none"
                      />
                    </td>
                    <td className="px-4 py-2 text-slate-500">{item.unit || "—"}</td>
                    <td className="px-4 py-2">
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={item.unit_price}
                        onChange={(e) =>
                          updateItem(index, "unit_price", parseFloat(e.target.value) || 0)
                        }
                        className="w-full rounded border border-slate-300 px-2 py-1.5 text-right text-sm focus:border-blue-500 focus:outline-none"
                      />
                    </td>
                    <td className="px-4 py-2 text-right font-medium text-slate-700">
                      {(item.quantity * item.unit_price).toLocaleString("th-TH", {
                        minimumFractionDigits: 2,
                      })}
                    </td>
                    <td className="px-4 py-2">
                      {items.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeItem(index)}
                          className="text-slate-300 hover:text-red-500 transition-colors"
                        >
                          <Trash2 size={15} />
                        </button>
                      )}
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
                    ฿{totalAmount.toLocaleString("th-TH", { minimumFractionDigits: 2 })}
                  </td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {errorMessage && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
            {errorMessage}
          </p>
        )}

        <div className="flex justify-end gap-3">
          <Link
            href="/requisitions"
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50"
          >
            ยกเลิก
          </Link>
          <button
            type="submit"
            disabled={isSubmitting}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-blue-700 disabled:opacity-60"
          >
            {isSubmitting ? "กำลังบันทึก..." : "บันทึกเป็นร่าง"}
          </button>
        </div>
      </form>
    </div>
  );
}
