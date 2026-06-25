"use client";
import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import type { Supplier } from "@/types/database";

export default function EditSupplierPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const supabase = createClient();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [supplier, setSupplier] = useState<Supplier | null>(null);

  useEffect(() => {
    supabase
      .from("suppliers")
      .select("*")
      .eq("id", id)
      .single()
      .then(({ data }) => {
        setSupplier(data as Supplier | null);
        setIsLoading(false);
      });
  }, [id, supabase]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setErrorMessage(null);

    const formData = new FormData(event.currentTarget);
    const payload = {
      name: formData.get("name") as string,
      tax_id: (formData.get("tax_id") as string) || null,
      contact_name: (formData.get("contact_name") as string) || null,
      phone: (formData.get("phone") as string) || null,
      email: (formData.get("email") as string) || null,
      address: (formData.get("address") as string) || null,
    };

    const { error } = await supabase.from("suppliers").update(payload).eq("id", id);

    if (error) {
      setErrorMessage(error.message);
      setIsSubmitting(false);
      return;
    }

    router.push("/suppliers");
    router.refresh();
  }

  if (isLoading) {
    return <div className="py-16 text-center text-sm text-slate-400">กำลังโหลด...</div>;
  }

  if (!supplier) {
    return (
      <div className="py-16 text-center">
        <p className="text-slate-500">ไม่พบข้อมูลผู้ขาย</p>
        <Link href="/suppliers" className="mt-2 text-sm text-blue-600 hover:underline">
          กลับหน้าผู้ขาย
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-xl space-y-5">
      <div className="flex items-center gap-3">
        <Link href="/suppliers" className="text-slate-400 hover:text-slate-600">
          <ArrowLeft size={20} />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-slate-800">แก้ไขผู้ขาย</h1>
          <p className="text-xs text-slate-400 font-mono">{supplier.code}</p>
        </div>
      </div>

      <form
        onSubmit={handleSubmit}
        className="space-y-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
      >
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">
            ชื่อผู้ขาย <span className="text-red-500">*</span>
          </label>
          <input
            name="name"
            required
            defaultValue={supplier.name}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">
            เลขประจำตัวผู้เสียภาษี
          </label>
          <input
            name="tax_id"
            defaultValue={supplier.tax_id ?? ""}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              ชื่อผู้ติดต่อ
            </label>
            <input
              name="contact_name"
              defaultValue={supplier.contact_name ?? ""}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">เบอร์โทร</label>
            <input
              name="phone"
              defaultValue={supplier.phone ?? ""}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            />
          </div>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">อีเมล</label>
          <input
            name="email"
            type="email"
            defaultValue={supplier.email ?? ""}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">ที่อยู่</label>
          <textarea
            name="address"
            rows={3}
            defaultValue={supplier.address ?? ""}
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
            href="/suppliers"
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
