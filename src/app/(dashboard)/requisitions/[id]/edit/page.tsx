export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PREditForm } from "@/components/pr/PREditForm";
import { formatDateTime } from "@/lib/utils/format";
import Link from "next/link";
import { ArrowLeft, RotateCcw, Clock, FileText, Send, CheckCircle2, XCircle, X } from "lucide-react";

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
  ] = await Promise.all([
    (supabase as any)
      .from("purchase_requisitions")
      .select(`id, pr_number, title, note, is_urgent, needed_by, branch_id, bank_name, bank_account_number,
               requester_id, status, created_at,
               submitted_at, submitted_by, approved_at, approved_by,
               rejected_at, rejected_by, rejection_reason, cancelled_at, cancelled_by,
               profiles!requester_id(full_name, email)`)
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
  ]);

  // Guard: เฉพาะเจ้าของ PR และสถานะ draft หรือ returned เท่านั้น
  if (!pr || pr.requester_id !== user.id || !["draft", "returned"].includes(pr.status)) {
    redirect(`/requisitions/${id}`);
  }

  // ── Timeline data ──────────────────────────────────────────────────────
  const requester = pr.profiles as { full_name: string; email: string } | null;

  const auditIds = [pr.submitted_by, pr.approved_by, pr.rejected_by, pr.cancelled_by]
    .filter((v: unknown): v is string => typeof v === "string" && v.length > 0);
  const uniqueIds = [...new Set(auditIds)];

  const { data: auditProfileList } = uniqueIds.length > 0
    ? await (supabase as any).from("profiles").select("id, full_name").in("id", uniqueIds)
    : { data: [] };

  const nameOf: Record<string, string> = Object.fromEntries(
    ((auditProfileList as { id: string; full_name: string }[] | null) ?? [])
      .map((p: { id: string; full_name: string }) => [p.id, p.full_name])
  );

  type TimelineEntry = {
    at: string;
    label: string;
    by: string;
    color: "slate" | "blue" | "green" | "red" | "orange";
    icon: React.ElementType;
    reason?: string;
  };

  const timeline: TimelineEntry[] = [
    { at: pr.created_at, label: "สร้างใบขอซื้อ", by: requester?.full_name ?? requester?.email ?? "—", color: "slate", icon: FileText },
  ];
  if (pr.submitted_at && pr.submitted_by) {
    timeline.push({ at: pr.submitted_at, label: "ส่งขออนุมัติ", by: nameOf[pr.submitted_by] ?? "—", color: "blue", icon: Send });
  }
  if (pr.approved_at && pr.approved_by) {
    timeline.push({ at: pr.approved_at, label: "อนุมัติ", by: nameOf[pr.approved_by] ?? "—", color: "green", icon: CheckCircle2 });
  }
  if (pr.rejected_at && pr.rejected_by) {
    timeline.push({
      at: pr.rejected_at,
      label: pr.status === "returned" ? "ตีกลับ" : "ไม่อนุมัติ",
      by: nameOf[pr.rejected_by] ?? "—",
      color: pr.status === "returned" ? "orange" : "red",
      icon: XCircle,
      reason: pr.rejection_reason ?? undefined,
    });
  }
  if (pr.cancelled_at && pr.cancelled_by) {
    timeline.push({ at: pr.cancelled_at, label: "ยกเลิก", by: nameOf[pr.cancelled_by] ?? "—", color: "red", icon: X });
  }
  timeline.sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());

  const colorMap = {
    slate:  { dot: "bg-slate-400",  text: "text-slate-500",  badge: "bg-slate-100 text-slate-600" },
    blue:   { dot: "bg-blue-500",   text: "text-blue-600",   badge: "bg-blue-50 text-blue-700" },
    green:  { dot: "bg-green-500",  text: "text-green-600",  badge: "bg-green-50 text-green-700" },
    red:    { dot: "bg-red-500",    text: "text-red-600",    badge: "bg-red-50 text-red-700" },
    orange: { dot: "bg-orange-400", text: "text-orange-600", badge: "bg-orange-50 text-orange-700" },
  };

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
        currentUserId={user.id}
      />

      {/* ── ประวัติการดำเนินการ — ล่างสุด ─────────────────────────────────── */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-center gap-2">
          <Clock size={16} className="text-slate-400" />
          <h3 className="font-semibold text-slate-700">ประวัติการดำเนินการ PR</h3>
        </div>
        <ol className="relative ml-2 space-y-5 border-l border-slate-200">
          {timeline.map((entry, i) => {
            const c = colorMap[entry.color];
            const Icon = entry.icon;
            return (
              <li key={i} className="ml-5">
                <span className={`absolute -left-[9px] flex h-4 w-4 items-center justify-center rounded-full ${c.dot}`} />
                <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                  <span className={`text-sm font-semibold ${c.text}`}>
                    <Icon size={13} className="mr-1 inline-block" />
                    {entry.label}
                  </span>
                  <span className="text-sm text-slate-700">โดย {entry.by}</span>
                  <span className="text-xs text-slate-400">{formatDateTime(entry.at)}</span>
                </div>
                {entry.reason && (
                  <p className={`mt-1 rounded-lg border px-3 py-1.5 text-xs ${c.badge}`}>
                    &ldquo;{entry.reason}&rdquo;
                  </p>
                )}
              </li>
            );
          })}
        </ol>
      </div>

    </div>
  );
}
