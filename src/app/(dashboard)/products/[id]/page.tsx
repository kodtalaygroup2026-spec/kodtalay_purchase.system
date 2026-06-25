"use client";
import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import type { Product } from "@/types/database";

interface Category {
  id: string;
  name: string;
}

export default function EditProductPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const supabase = createClient();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [product, setProduct] = useState<Product | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);

  useEffect(() => {
    Promise.all([
      supabase.from("products").select("*").eq("id", id).single(),
      supabase.from("categories").select("id, name").order("name"),
    ]).then(([{ data: productData }, { data: categoriesData }]) => {
      setProduct(productData as Product | null);
      setCategories(categoriesData ?? []);
      setIsLoading(false);
    });
  }, [id, supabase]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setErrorMessage(null);

    const formData = new FormData(event.currentTarget);
    const categoryId = formData.get("category_id") as string;
    const payload = {
      name: formData.get("name") as string,
      unit: formData.get("unit") as string,
      unit_price: parseFloat(formData.get("unit_price") as string),
      category_id: categoryId || null,
    };

    const { error } = await supabase.from("products").update(payload).eq("id", id);

    if (error) {
      setErrorMessage(error.message);
      setIsSubmitting(false);
      return;
    }

    router.push("/products");
    router.refresh();
  }

  if (isLoading) {
    return <div className="py-16 text-center text-sm text-slate-400">กำลังโหลด...</div>;
  }

  if (!product) {
    return (
      <div className="py-16 text-center">
        <p className="text-slate-500">ไม่พบข้อมูลสินค้า</p>
        <Link href="/products" className="mt-2 text-sm text-blue-600 hover:underline">
          กลับหน้าสินค้า
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-xl space-y-5">
      <div className="flex items-center gap-3">
        <Link href="/products" className="text-slate-400 hover:text-slate-600">
          <ArrowLeft size={20} />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-slate-800">แก้ไขสินค้า</h1>
          <p className="text-xs text-slate-400 font-mono">{product.sku}</p>
        </div>
      </div>

      <form
        onSubmit={handleSubmit}
        className="space-y-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
      >
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">
            ชื่อสินค้า <span className="text-red-500">*</span>
          </label>
          <input
            name="name"
            required
            defaultValue={product.name}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">หมวดหมู่</label>
            <select
              name="category_id"
              defaultValue={product.category_id ?? ""}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            >
              <option value="">— ไม่ระบุ —</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">หน่วย <span className="text-red-500">*</span></label>
            <input
              name="unit"
              required
              defaultValue={product.unit}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            />
          </div>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">
            ราคาต่อหน่วย (บาท) <span className="text-red-500">*</span>
          </label>
          <input
            name="unit_price"
            type="number"
            required
            min="0"
            step="0.01"
            defaultValue={product.unit_price}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
          />
        </div>

        {errorMessage && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
            {errorMessage}
          </p>
        )}

        <div className="flex justify-end gap-3 pt-2">
          <Link
            href="/products"
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50"
          >
            ยกเลิก
          </Link>
          <button
            type="submit"
            disabled={isSubmitting}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-blue-700 disabled:opacity-60"
          >
            {isSubmitting ? "กำลังบันทึก..." : "บันทึก"}
          </button>
        </div>
      </form>
    </div>
  );
}
