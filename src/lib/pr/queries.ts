import { createClient } from "@/lib/supabase/server";

export async function getPRList() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("purchase_requisitions")
    .select(
      `id, pr_number, title, status, total_amount, created_at, needed_by,
       profiles!requester_id(full_name)`
    )
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data ?? [];
}

export async function getPRById(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("purchase_requisitions")
    .select(
      `*, profiles!requester_id(full_name, email, role)`
    )
    .eq("id", id)
    .single();

  if (error) throw error;
  return data;
}

export async function getPRItems(prId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("pr_items")
    .select(`*`)
    .eq("pr_id", prId)
    .order("line_no");

  if (error) throw error;
  return data ?? [];
}

export async function getPRApprovals(prId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("approvals")
    .select(`*, profiles!approver_id(full_name, role)`)
    .eq("reference_id", prId)
    .eq("reference_type", "PR")
    .order("step");

  if (error) throw error;
  return data ?? [];
}
