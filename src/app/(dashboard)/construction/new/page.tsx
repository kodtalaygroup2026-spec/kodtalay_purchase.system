"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { CompanySelector, getBranchBorderColor } from "@/components/shared/CompanySelector";
import type { Branch } from "@/types/database";

export default function NewConstructionPage() {
  const router = useRouter();
  const supabase = createClient();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [branchId, setBranchId] = useState("");

  useEffect(() => {
    async function loadBranches() {
      const { data: branchData } = await (supabase as any)
        .from("branches")
        .select("*")
        .eq("is_active", true)
        .order("code");
      const list: Branch[] = branchData ?? [];
      setBranches(list);

      const saved = localStorage.getItem("last_branch_id");
      if (saved && list.some((b) => b.id === saved)) {
        setBranchId(saved);
        return;
      }
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await (supabase as any)
          .from("profiles")
          .select("branch_id")
          .eq("id", user.id)
          .single();
        if (profile?.branch_id) setBranchId(profile.branch_id);
        else if (list.length > 0) setBranchId(list[0].id);
      }
    }
    loadBranches();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectedBranch = branches.find((b) => b.id === branchId);
  const borderColor = getBranchBorderColor(selectedBranch?.code);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setErrorMessage(null);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setErrorMessage("กรุณาล็อกอินก่อน");
      setIsSubmitting(false);
      return;
    }

    const formData = new FormData(event.currentTarget);
    const branchCode = selectedBranch?.code ?? "CT";

    // สร้างเลขที่ ticket ผ่าน RPC
    const { data: ticketNumber, error: rpcError } = await supabase.rpc(
      "next_document_number",
      { prefix: branchCode, table_name: "construction_tickets", column_name: "ticket_number" }
    );
    if (rpcError) {
      setErrorMessage(rpcError.message);
      setIsSubmitting(false);
      return;
    }

    const { data: ticket, error } = await (supabase as any)
      .from("construction_tickets")
      .insert({
        ticket_number: ticketNumber,
        title: formData.get("title") as string,
        location: (formData.get("location") as string) || null,
        description: (formData.get("description") as string) || null,
        requester_id: user.id,
        branch_id: branchId || null,
        status: "open",
      })
      .select("id")
      .single();

    if (error || !ticket) {
      setErrorMessage(error?.message ?? "เกิดข้อผิดพลาด");
      setIsSubmitting(false);
      return;
    }

    router.push(`/construction/${ticket.id}`);
    router.refresh();
  }

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <div className="flex items-center gap-3">
        <Link href="/construction" className="text-slate-400 hover:text-slate-600">
          <ArrowLeft size={20} />
        </Link>
        <h1 className="text-xl font-bold text-slate-800">เปิดงานก่อสร้างใหม่</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className={`space-y-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm border-l-4 ${borderColor} transition-colors`}>
          <div className="flex items-start justify-between gap-4">
            <h2 className="font-semibold text-slate-700">ข้อมูลงาน</h2>
            {branches.length > 0 && (
              <CompanySelector
                branches={branches}
                selectedId={branchId}
                onChange={(id) => {
                  setBranchId(id);
                  localStorage.setItem("last_branch_id", id);
                }}
              />
            )}
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              ชื่องาน <span className="text-red-500">*</span>
            </label>
            <input
              name="title"
              required
              placeholder="เช่น ต่อเติมอาคารสำนักงาน อาคาร B"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-violet-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">สถานที่</label>
            <input
              name="location"
              placeholder="เช่น สาขาลาดพร้าว, ชั้น 3"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-violet-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">รายละเอียด</label>
            <textarea
              name="description"
              rows={3}
              placeholder="รายละเอียดงานที่ต้องการ..."
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-violet-500 focus:outline-none"
            />
          </div>
        </div>

        {errorMessage && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{errorMessage}</p>
        )}

        <div className="flex justify-end gap-3">
          <Link
            href="/construction"
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50"
          >
            ยกเลิก
          </Link>
          <button
            type="submit"
            disabled={isSubmitting}
            className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-violet-700 disabled:opacity-60"
          >
            {isSubmitting ? "กำลังบันทึก..." : "เปิดงาน"}
          </button>
        </div>
      </form>
    </div>
  );
}
