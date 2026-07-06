// ===========================================================================
// File: src/lib/line/externalLink.ts
// คำอธิบาย: เติมพารามิเตอร์ให้ LINE เปิดลิงก์ในเบราว์เซอร์ภายนอก (Chrome/Safari)
//          แทน "เบราว์เซอร์ในแอป LINE" — ป้องกัน Google OAuth error 403
//          (disallowed_useragent) ตอนผู้ใช้กดลิงก์จากข้อความ LINE
// ===========================================================================

/**
 * เติม ?openExternalBrowser=1 (หรือ &openExternalBrowser=1) ท้าย URL
 * เมื่อผู้ใช้กดลิงก์ในแอป LINE จะเปิดในเบราว์เซอร์จริงของเครื่องทันที
 *
 * @example
 * externalBrowserLink("https://app.com/requisitions/123")
 * // → "https://app.com/requisitions/123?openExternalBrowser=1"
 */
export function externalBrowserLink(url: string): string {
  const separator = url.includes("?") ? "&" : "?";
  return `${url}${separator}openExternalBrowser=1`;
}
