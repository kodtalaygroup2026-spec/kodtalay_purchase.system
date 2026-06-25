# สถาปัตยกรรมระบบ (Architecture) — kodtalay_purchase.system

> เวอร์ชัน 0.1.0

## 1. ภาพรวม

ระบบจัดซื้อ/จัดจ้าง (Procurement & Purchase Order) แบบ full-stack บน **Next.js 14 (App Router)**
ใช้ **Supabase** เป็นทั้งฐานข้อมูล (PostgreSQL), ระบบยืนยันตัวตน (Auth) และความปลอดภัยระดับแถว (RLS)

```
┌─────────────────────────────────────────────────────────┐
│                     ผู้ใช้ (Browser)                       │
└───────────────────────────┬─────────────────────────────┘
                            │ HTTPS
┌───────────────────────────▼─────────────────────────────┐
│                  Next.js 14 (App Router)                  │
│  ┌─────────────────┐   ┌──────────────────────────────┐ │
│  │ Server Components│   │ Client Components ("use client")│ │
│  │ (ดึงข้อมูลฝั่ง   │   │ (ฟอร์ม, interactivity)         │ │
│  │  server, เร็ว)   │   └──────────────────────────────┘ │
│  └─────────────────┘                                      │
│  middleware.ts — refresh session + ป้องกันหน้า protected   │
└───────────────────────────┬─────────────────────────────┘
                            │ @supabase/ssr (anon key + RLS)
                            │ service role (เฉพาะงาน server พิเศษ)
┌───────────────────────────▼─────────────────────────────┐
│                        Supabase                          │
│   PostgreSQL  ·  Auth  ·  Row Level Security  ·  Storage  │
└─────────────────────────────────────────────────────────┘
```

## 2. เหตุผลการเลือก Stack

| ความต้องการ | ทางเลือกที่ใช้ | เหตุผล |
|---|---|---|
| เสถียร | TypeScript (strict) + zod validate env | จับ error ตั้งแต่ compile-time / boot-time |
| เร็ว | Server Components + SSR + index ครบ | ลด JS ฝั่ง client, query เร็ว |
| ปลอดภัย | RLS ทุกตาราง + แยก service role | ผู้ใช้เข้าถึงเฉพาะข้อมูลที่มีสิทธิ์ |
| ออนไลน์ | Supabase (managed Postgres) | ตามที่ผู้ใช้เลือก |

## 3. ชั้นการเข้าถึงข้อมูล (Data Access Layers)

1. **Browser client** (`src/lib/supabase/client.ts`) — anon key, อยู่ภายใต้ RLS
2. **Server client** (`src/lib/supabase/server.ts`) — anon key + session จาก cookie, อยู่ภายใต้ RLS
3. **Admin client** (`src/lib/supabase/admin.ts`) — service role, **ข้าม RLS** ใช้ฝั่ง server เท่านั้น

## 4. ความปลอดภัย (Security)

- เปิด **RLS ทุกตาราง** — ค่าเริ่มต้นคือ "ปฏิเสธทั้งหมด" จนกว่าจะมี policy อนุญาต
- แยกสิทธิ์ตามบทบาท (`admin`, `manager`, `purchaser`, `requester`, `viewer`)
- service role key ไม่มี prefix `NEXT_PUBLIC_` และมี `import "server-only"` กันหลุดไป client
- หน้า login ไม่เปิดเผยว่าอีเมลมีในระบบหรือไม่ (กัน user enumeration)
- header `X-Powered-By` ถูกปิดใน `next.config.mjs`

## 5. ประสิทธิภาพ (Performance)

- ดึงข้อมูลฝั่ง server (Server Components) ลดขนาด bundle ฝั่ง client
- สร้าง **index** บนคอลัมน์ที่ใช้ค้นหา/กรองบ่อย (status, foreign keys)
- `line_total` เป็น **generated column** — ไม่ต้องคำนวณซ้ำและถูกต้องเสมอ
- middleware `matcher` ข้าม static assets เพื่อไม่เสีย overhead
- `optimizePackageImports` ลดขนาด bundle ของ supabase-js
