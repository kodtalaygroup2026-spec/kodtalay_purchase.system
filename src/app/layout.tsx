// ===========================================================================
// File: src/app/layout.tsx
// คำอธิบาย: Root layout ของแอป กำหนด metadata, ภาษา และ global styles
// ===========================================================================
import type { Metadata } from "next";

import { APP_NAME } from "@/lib/constants";
import "./globals.css";

export const metadata: Metadata = {
  title: APP_NAME,
  description: "ระบบจัดซื้อ/จัดจ้าง (Procurement & Purchase Order) ของ Kodtalay Group",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="th">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
