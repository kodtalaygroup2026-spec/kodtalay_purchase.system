/**
 * นับ "งานเอกสารของฉันที่ยังไม่จบ" — ใช้ร่วมกันทั้ง server (badge ตอนโหลดหน้า)
 * และ client (hook เรียลไทม์) เพื่อให้ตัวเลขตรงกับหน้า /requisitions/incomplete เสมอ
 *
 * นับ 2 กรณี (ตรงกับ docStateOf ในหน้านั้น):
 *   • awaiting_docs = จ่ายแล้ว (PR paid) แต่หลักฐานล่าสุด close_status = incomplete
 *   • pending_fix   = ถูกตีกลับก่อนจ่าย (evidence returned + incomplete, PR ยัง approved/converted)
 *
 * ใบที่ส่งแก้แล้ว (close_status = fixed) ไม่ถูกนับ — ถือว่ารอ บช. ตรวจ ไม่ใช่งานค้างของเรา
 */
export async function countIncompleteDocs(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  userId: string
): Promise<{ count: number; pendingFixIds: Set<string> }> {
  const empty = { count: 0, pendingFixIds: new Set<string>() };

  // ใบที่ฉันเป็นเจ้าของก่อน แล้วค่อยดึงหลักฐานของใบเหล่านั้น
  // (ไม่กรองด้วย submitted_by เพราะบางใบ บช./แอดมินกดส่งแทน — ถ้ากรองด้วยคนส่ง
  //  จะหาแถวหลักฐานไม่เจอแล้วใบที่จ่ายแล้วเอกสารไม่ครบจะหลุดหายจาก badge)
  const { data: myPRs } = await supabase
    .from("purchase_requisitions")
    .select("id, status")
    .eq("requester_id", userId)
    .limit(300);

  const prList = (myPRs ?? []) as { id: string; status: string }[];
  if (prList.length === 0) return empty;

  const prStatusById: Record<string, string> = Object.fromEntries(
    prList.map((p) => [p.id, p.status])
  );

  // ต้องดูหลักฐาน "ฉบับล่าสุด" ต่อใบเสมอ ไม่งั้นจะนับแถว incomplete เก่าที่ถูกแก้/
  // ส่งให้การเงินตรวจไปแล้วซ้ำ ทำให้ตัวเลขเกินจริง
  const { data: evRows } = await supabase
    .from("payment_evidences")
    .select("pr_id, status, close_status, submitted_at")
    .in("pr_id", prList.map((p) => p.id))
    .order("submitted_at", { ascending: false })
    .limit(400);

  if (!evRows || evRows.length === 0) return empty;

  const latestByPr = new Map<string, { status: string; close_status: string | null }>();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const ev of evRows as any[]) {
    if (!latestByPr.has(ev.pr_id)) latestByPr.set(ev.pr_id, ev);
  }

  let count = 0;
  const pendingFixIds = new Set<string>();
  for (const [prId, ev] of latestByPr) {
    const prStatus = prStatusById[prId];
    if (!prStatus) continue;
    // จ่ายแล้วแต่ค้างเอกสารตัวจริง
    const isAwaitingDocs = prStatus === "paid" && ev.close_status === "incomplete";
    // ถูกตีกลับก่อนจ่าย รอแก้แล้วส่งใหม่
    const isPendingFix =
      ev.status === "returned" &&
      ev.close_status === "incomplete" &&
      ["approved", "converted"].includes(prStatus);
    if (isPendingFix) pendingFixIds.add(prId);
    if (isAwaitingDocs || isPendingFix) count++;
  }
  return { count, pendingFixIds };
}
