export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PREditForm } from "@/components/pr/PREditForm";
import Link from "next/link";
import { ArrowLeft, RotateCcw } from "lucide-react";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function EditRequisitionPage({ params }: PageProps) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [
    { data: pr },
    { data: prItems },
    { data: attachments },
    { data: branches },
    { data: products },
  ] = await Promise.all([
    (supabase as any)
      .from("purchase_requisitions")
      .select("id, pr_number, title, note, is_urgent, needed_by, branch_id, bank_name, bank_account_number, requester_id, status")
      .eq("id", id)
      .single(),
    supabase
      .from("pr_items")
      .select("id, line_no, description, quantity, unit, unit_price, product_id")
      .eq("pr_id", id)
      .order("line_no"),
    (supabase as any)
      .from("pr_attachments")
      .select("id, file_name, file_url, file_type, file_size")
      .eq("pr_id", id)
      .order("created_at"),
    (supabase as any)
      .from("branches")
      .select("id, name, code, is_active")
      .eq("is_active", true)
      .order("code"),
    supabase
      .from("products")
      .select("id, name, sku, unit, unit_price")
      .eq("is_active", true)
      .order("name"),
  ]);

  // Guard: เฉพาะเจ้าของ PR และสถานะ draft หรือ returned เท่านั้น
  if (!pr || pr.requester_id !== user.id || !["draft", "returned"].includes(pr.status)) {
    redirect(`/requisitions/${id}`);
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5">

      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href={`/requisitions/${id}`} className="text-slate-400 hover:text-slate-600">
          <ArrowLeft size={20} />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-slate-800">
            {pr.status === "returned" ? "แก้ไขและส่งใหม่" : "แก้ไขใบขอซื้อ"}
          </h1>
          <p className="text-sm text-slate-500 font-mono">{pr.pr_number}</p>
        </div>
      </div>

      {/* Banner ตีกลับ — แสดงเฉพาะสถานะ returned */}
      {pr.status === "returned" && (
        <div className="flex items-start gap-3 rounded-lg border border-orange-200 bg-orange-50 px-4 py-3">
          <RotateCcw size={16} className="mt-0.5 shrink-0 text-orange-500" />
          <div>
            <p className="text-sm font-semibold text-orange-700">ใบขอซื้อถูกตีกลับ</p>
            <p className="text-xs text-orange-600 mt-0.5">
              กรุณาแก้ไขข้อมูลหรือไฟล์แนบที่ไม่ถูกต้อง แล้วกด &quot;ส่งขออนุมัติใหม่&quot;
            </p>
          </div>
        </div>
      )}

      <PREditForm
        prStatus={pr.status as "draft" | "returned"}
        pr={{
          id: pr.id,
          pr_number: pr.pr_number,
          title: pr.title,
          note: pr.note ?? null,
          is_urgent: pr.is_urgent ?? false,
          needed_by: pr.needed_by ?? null,
          branch_id: pr.branch_id,
          bank_name: pr.bank_name ?? null,
          bank_account_number: pr.bank_account_number ?? null,
        }}
        prItems={(prItems ?? []) as {
          id: string; description: string; quantity: number;
          unit: string; unit_price: number; product_id: string | null;
        }[]}
        attachments={(attachments ?? []) as {
          id: string; file_name: string; file_url: string;
          file_type: "image" | "pdf"; file_size: number | null;
        }[]}
        branches={branches ?? []}
        products={(products ?? []) as {
          id: string; name: string; sku: string; unit: string; unit_price: number;
        }[]}
        currentUserId={user.id}
      />
    </div>
  );
}
