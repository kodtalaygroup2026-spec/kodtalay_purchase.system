import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { UserRoleTable } from "@/components/settings/UserRoleTable";

export default async function UsersSettingsPage() {
  const supabase = await createClient();

  // ตรวจสิทธิ์: เฉพาะ admin เท่านั้น
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: currentProfile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (currentProfile?.role !== "admin") redirect("/");

  // ดึงผู้ใช้ทั้งหมด
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, full_name, email, department, role, is_active, created_at")
    .order("created_at", { ascending: true });

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-slate-800">จัดการผู้ใช้</h1>
        <p className="text-sm text-slate-500">
          ตั้งค่าบทบาทของผู้ใช้แต่ละคน — ผู้ใช้ใหม่ที่ login ครั้งแรกจะได้รับบทบาท &quot;ผู้ขอซื้อ&quot; อัตโนมัติ
        </p>
      </div>

      {/* คำอธิบาย role */}
      <div className="rounded-lg border border-blue-100 bg-blue-50 p-4 text-sm text-blue-800">
        <p className="font-semibold mb-1">คำอธิบายบทบาท:</p>
        <ul className="space-y-0.5 list-disc list-inside text-blue-700">
          <li><strong>ผู้ขอซื้อ</strong> — พนักงานทั่วไป สร้างใบขอซื้อ (PR) ได้ (default)</li>
          <li><strong>ผู้อนุมัติ</strong> — หัวหน้า/ผู้จัดการ อนุมัติหรือปฏิเสธ PR ก่อนส่งฝ่ายจัดซื้อ</li>
          <li><strong>เจ้าหน้าที่จัดซื้อ</strong> — ทีมบัญชี/จัดซื้อ ออกใบสั่งซื้อ (PO) และบันทึกรับของ</li>
          <li><strong>ผู้ดูแลระบบ</strong> — จัดการได้ทุกอย่าง รวมถึงหน้านี้</li>
        </ul>
      </div>

      <UserRoleTable
        profiles={profiles ?? []}
        currentUserId={user.id}
      />
    </div>
  );
}
