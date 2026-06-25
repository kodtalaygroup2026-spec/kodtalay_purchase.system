import { createClient } from "@/lib/supabase/server";
import type { ExpenseItem, ExpenseRequest, Branch } from "@/types/database";

export type ExpenseRequestWithBranch = ExpenseRequest & {
  branch: Pick<Branch, "code" | "name"> | null;
  requester: { full_name: string; email: string } | null;
};

export async function getExpenseList(filters?: {
  status?: string;
  branch_id?: string;
}): Promise<ExpenseRequestWithBranch[]> {
  const supabase = await createClient();
  let query = (supabase as any)
    .from("expense_requests")
    .select("*, branch:branches(code, name), requester:profiles(full_name, email)")
    .order("created_at", { ascending: false });

  if (filters?.status) {
    query = query.eq("status", filters.status);
  }
  if (filters?.branch_id) {
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
