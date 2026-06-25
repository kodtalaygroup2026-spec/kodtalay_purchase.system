"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

interface CreateExpenseInput {
  title: string;
  branch_id: string;
  request_date: string;
  note?: string;
  items: { description: string; amount: number }[];
}

export async function createExpense(input: CreateExpenseInput) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  // สร้างเลขที่ใบเบิก
  const { data: numData, error: numError } = await (supabase as any).rpc(
    "next_document_number",
    { prefix: "EXP", table_name: "expense_requests", column_name: "request_number" }
  );
  if (numError) throw new Error(numError.message);

  const { data: expense, error: expError } = await (supabase as any)
    .from("expense_requests")
    .insert({
      request_number: numData,
      title: input.title,
      branch_id: input.branch_id,
      requester_id: user.id,
      request_date: input.request_date,
      note: input.note ?? null,
    })
    .select("id")
    .single();

  if (expError) throw new Error(expError.message);

  if (input.items.length > 0) {
    const { error: itemError } = await (supabase as any)
      .from("expense_items")
      .insert(
        input.items.map((item) => ({
          expense_id: expense.id,
          description: item.description,
          amount: item.amount,
        }))
      );
    if (itemError) throw new Error(itemError.message);
  }

  revalidatePath("/expenses");
  return expense.id as string;
}

export async function submitExpense(expenseId: string) {
  const supabase = await createClient();
  const { error } = await (supabase as any)
    .from("expense_requests")
    .update({ status: "submitted" })
    .eq("id", expenseId);

  if (error) throw new Error(error.message);
  revalidatePath("/expenses");
  revalidatePath(`/expenses/${expenseId}`);
}

export async function approveExpense(expenseId: string, comment?: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const { error } = await (supabase as any)
    .from("expense_requests")
    .update({ status: "approved" })
    .eq("id", expenseId);

  if (error) throw new Error(error.message);

  // บันทึก approval log
  await (supabase as any).from("approvals").insert({
    document_type: "expense",
    document_id: expenseId,
    approver_id: user.id,
    step: 1,
    decision: "approved",
    comment: comment ?? null,
    decided_at: new Date().toISOString(),
  });

  revalidatePath("/expenses");
  revalidatePath(`/expenses/${expenseId}`);
}

export async function rejectExpense(expenseId: string, comment?: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const { error } = await (supabase as any)
    .from("expense_requests")
    .update({ status: "rejected" })
    .eq("id", expenseId);

  if (error) throw new Error(error.message);

  await (supabase as any).from("approvals").insert({
    document_type: "expense",
    document_id: expenseId,
    approver_id: user.id,
    step: 1,
    decision: "rejected",
    comment: comment ?? null,
    decided_at: new Date().toISOString(),
  });

  revalidatePath("/expenses");
  revalidatePath(`/expenses/${expenseId}`);
}

export async function markAsPaid(expenseId: string, paymentDate: string) {
  const supabase = await createClient();
  const { error } = await (supabase as any)
    .from("expense_requests")
    .update({ status: "paid", payment_date: paymentDate })
    .eq("id", expenseId);

  if (error) throw new Error(error.message);
  revalidatePath("/expenses");
  revalidatePath(`/expenses/${expenseId}`);
}

export async function cancelExpense(expenseId: string) {
  const supabase = await createClient();
  const { error } = await (supabase as any)
    .from("expense_requests")
    .update({ status: "cancelled" })
    .eq("id", expenseId);

  if (error) throw new Error(error.message);
  revalidatePath("/expenses");
  revalidatePath(`/expenses/${expenseId}`);
}
