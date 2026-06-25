import { createClient } from "@/lib/supabase/server";
import type { ExpenseItem, ExpenseRequest, Branch, UserRole } from "@/types/database";

export type ExpenseRequestWithBranch = ExpenseRequest & {
  branch: Pick<Branch, "code" | "name"> | null;
  requester: { full_name: string; email: string } | null;
};

export type CurrentUserContext = {
  userId: string;
  role: UserRole;
  branchId: string | null;
};

/** ดึง context ของ user ที่ login อยู่ (userId, role, branchId) */
export async function getCurrentUserContext(): Promise<CurrentUserContext> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const { data: profile } = await (supabase as any)
    .from("profiles")
    .select("role, branch_id")
    .eq("id", user.id)
    .single();

  return {
    userId: user.id,
    role: profile?.role ?? "requester",
    branchId: profile?.branch_id ?? null,
  };
}

export async function getExpenseList(filters?: {
  status?: string;
  branch_id?: string;
}): Promise<ExpenseRequestWithBranch[]> {
  const supabase = await createClient();
  // RLS จัดการ company isolation อัตโนมัติ — admin เห็นทุกบริษัท, อื่นๆ เห็นแค่บริษัทตัวเอง
  let query = (supabase as any)
    .from("expense_requests")
    .select("*, branch:branches(code, name), requester:profiles(full_name, email)")
    .order("request_date", { ascending: false });

  if (filters?.status) {
    query = query.eq("status", filters.status);
  }
  if (filters?.branch_id) {
    // ใช้ได้เฉพาะ admin (คนอื่น RLS จะ block อยู่แล้ว)
    query = query.eq("branch_id", filters.branch_id);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getExpenseById(id: string): Promise<ExpenseRequestWithBranch | null> {
  const supabase = await createClient();
  const { data, error } = await (supabase as any)
    .from("expense_requests")
    .select("*, branch:branches(code, name), requester:profiles(full_name, email)")
    .eq("id", id)
    .single();

  if (error) return null;
  return data;
}

export async function getExpenseItems(expenseId: string): Promise<ExpenseItem[]> {
  const supabase = await createClient();
  const { data, error } = await (supabase as any)
    .from("expense_items")
    .select("*")
    .eq("expense_id", expenseId)
    .order("created_at", { ascending: true });

  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getBranches(): Promise<Branch[]> {
  const supabase = await createClient();
  const { data, error } = await (supabase as any)
    .from("branches")
    .select("*")
    .eq("is_active", true)
    .order("code");

  if (error) throw new Error(error.message);
  return data ?? [];
}
