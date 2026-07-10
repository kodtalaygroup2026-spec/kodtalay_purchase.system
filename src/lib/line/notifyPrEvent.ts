// ===========================================================================
// File: src/lib/line/notifyPrEvent.ts
// คำอธิบาย: แจ้งเตือน LINE ตามเหตุการณ์ของใบขอซื้อ
//           ข้อความประกอบจากฐานข้อมูลฝั่งเซิร์ฟเวอร์ client ส่งมาแค่ prId + event
// ===========================================================================

import { formatCurrency } from "@/lib/utils/format";
import { externalBrowserLink } from "@/lib/line/externalLink";
import { sendLineMulticast } from "@/lib/line/sendMessage";
import {
  getPrSummary,
  resolveApproverLineIds,
  resolveFinanceLineIds,
  type PrSummary,
} from "@/lib/line/resolveRecipients";

export type PrNotificationEvent =
  | "submitted"           // ผู้ขอส่งใบ → แจ้งผู้อนุมัติของใบนั้น
  | "evidence_submitted"  // ผู้ขอแนบบิล → แจ้งฝ่ายบัญชีให้มาตรวจสอบ
  | "verified";           // บช. ตรวจผ่าน → แจ้งฝ่ายบัญชีว่ามีของรอจ่าย

export interface NotifyPrEventParams {
  prId: string;
  event: PrNotificationEvent;
  /** ผู้ลงมือ — ไม่ต้องแจ้งเตือนตัวเอง */
  actorId?: string | null;
  /** origin ของเว็บ เช่น https://example.com ใช้ประกอบลิงก์ */
  baseUrl: string;
  /** ช่องทางจ่าย (เฉพาะ event = verified) */
  channel?: "company" | "petty_cash" | null;
}

/** บล็อกข้อมูลใบขอซื้อที่ใช้ซ้ำในทุกข้อความ */
function prDetailLines(pr: PrSummary): string {
  return (
    `เลขที่: ${pr.pr_number}\n` +
    `ผู้ขอ: ${pr.requester_name}\n` +
    `หัวข้อ: ${pr.title}\n` +
    `มูลค่ารวม: ${formatCurrency(pr.total_amount)}`
  );
}

/**
 * ส่งแจ้งเตือนตามเหตุการณ์ คืนจำนวนผู้รับที่ส่งจริง
 * ไม่ throw — การแจ้งเตือนล้มเหลวต้องไม่ทำให้ flow หลักพัง
 */
export async function notifyPrEvent(params: NotifyPrEventParams): Promise<number> {
  const { prId, event, actorId, baseUrl, channel } = params;

  const pr = await getPrSummary(prId);
  if (!pr) return 0;

  const prLink = externalBrowserLink(`${baseUrl}/requisitions/${pr.id}`);

  let recipients: string[] = [];
  let message = "";

  switch (event) {
    case "submitted": {
      recipients = await resolveApproverLineIds(pr);
      message =
        `📋 ใบขอซื้อใหม่รอการอนุมัติ\n\n` +
        `${prDetailLines(pr)}\n\n` +
        `👉 ดูรายละเอียด:\n${prLink}`;
      break;
    }

    case "evidence_submitted": {
      recipients = await resolveFinanceLineIds(actorId);
      const verifyLink = externalBrowserLink(`${baseUrl}/disbursement`);
      message =
        `🧾 มีหลักฐานการซื้อรอตรวจสอบ\n\n` +
        `${prDetailLines(pr)}\n\n` +
        `👉 เปิดงานตรวจสอบ:\n${verifyLink}`;
      break;
    }

    case "verified": {
      recipients = await resolveFinanceLineIds(actorId);
      const isPettyCash = channel === "petty_cash";
      const channelLabel = isPettyCash ? "เงินสดย่อย" : "บริษัทสั่งจ่าย";
      const paymentPath = isPettyCash ? "/finance/petty-cash" : "/finance/payments";
      message =
        `💰 มีรายการรอจ่าย (${channelLabel})\n\n` +
        `${prDetailLines(pr)}\n\n` +
        `👉 เปิดหน้าจ่ายเงิน:\n${externalBrowserLink(`${baseUrl}${paymentPath}`)}`;
      break;
    }
  }

  if (recipients.length === 0) return 0;

  await sendLineMulticast(recipients, message);
  return recipients.length;
}
