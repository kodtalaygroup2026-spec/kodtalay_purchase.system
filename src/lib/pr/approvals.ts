// ขอบเขตสิทธิ์อนุมัติของผู้ใช้ + ตัวนับใบที่ "อนุมัติได้จริง"
// ใช้ร่วมกันทั้งฝั่ง server (layout badge) และ client (realtime hook)
// ตรรกะต้องตรงกับหน้า /approvals เป๊ะ:
//   • admin / finance(บช.) → เห็นทุกใบ
//   • manager             → เห็นเฉพาะแผนกตัวเอง
//   • สมาชิกตำแหน่ง        → เห็นเฉพาะหมวดที่ตำแหน่งตนดูแล

export interface ApproverScope {
  role: string | null;
  department: string | null;
  positionIds: string[];
}

/** ผู้ใช้คนนี้มีสิทธิ์อนุมัติอะไรบ้างไหม (ใช้กันการ subscribe โดยไม่จำเป็น) */
export function canApproveAnything(scope: ApproverScope): boolean {
  const isManager = scope.role === "manager" || scope.role === "admin";
  const isFinance = scope.role === "finance";
  return isManager || isFinance || scope.positionIds.length > 0;
}

/** นับใบขอซื้อสถานะ submitted ที่ผู้ใช้คนนี้อนุมัติได้ (distinct ต่อใบอยู่แล้ว) */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function countApprovablePRs(supabase: any, scope: ApproverScope): Promise<number> {
  if (!canApproveAnything(scope)) return 0;

  const { role, department, positionIds } = scope;
  const isManager = role === "manager" || role === "admin";
  const isFinance = role === "finance";
  const positionSet = new Set(positionIds);

  const { data } = await supabase
    .from("purchase_requisitions")
    .select("id, profiles!requester_id(department), categories!category_id(position_id)")
    .eq("status", "submitted")
    .limit(500);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rows = (data ?? []) as any[];
  return rows.filter((pr) => {
    if (role === "admin" || isFinance) return true;
    const requesterDept = pr.profiles?.department ?? null;
    const isDeptHead = isManager && !!department && requesterDept === department;
    const categoryPosition = pr.categories?.position_id ?? null;
    const isPositionApprover = !!categoryPosition && positionSet.has(categoryPosition);
    return isDeptHead || isPositionApprover;
  }).length;
}
