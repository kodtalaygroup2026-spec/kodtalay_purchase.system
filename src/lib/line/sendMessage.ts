const LINE_PUSH_URL = "https://api.line.me/v2/bot/message/push";

interface LineMessage {
  type: "text";
  text: string;
}

// ส่งข้อความตรงไปยัง LINE User ID เฉพาะคน
export async function sendLinePushMessage(
  lineUserId: string,
  messages: LineMessage[],
): Promise<void> {
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  if (!token || !lineUserId) return;

  const response = await fetch(LINE_PUSH_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ to: lineUserId, messages }),
  });

  if (!response.ok) {
    const body = await response.text();
    console.error("LINE push error:", response.status, body);
  }
}

export function buildPRNotificationMessage(params: {
  event: "submitted" | "approved" | "rejected";
  prNumber: string;
  title: string;
  requesterName: string;
  totalAmount: number;
  prUrl: string;
  note?: string;
}): string {
  const { event, prNumber, title, requesterName, totalAmount, prUrl, note } = params;

  const amountText = new Intl.NumberFormat("th-TH", {
    style: "currency",
    currency: "THB",
  }).format(totalAmount);

  const eventLabel =
    event === "submitted"
      ? "📋 ใบขอซื้อใหม่รออนุมัติ"
      : event === "approved"
        ? "✅ ใบขอซื้ออนุมัติแล้ว"
        : "❌ ใบขอซื้อไม่ผ่านการอนุมัติ";

  const lines = [
    eventLabel,
    `เลขที่: ${prNumber}`,
    `เรื่อง: ${title}`,
    `ผู้ขอ: ${requesterName}`,
    `มูลค่า: ${amountText}`,
  ];

  if (note) lines.push(`หมายเหตุ: ${note}`);
  lines.push(`ดูรายละเอียด: ${prUrl}`);

  return lines.join("\n");
}
