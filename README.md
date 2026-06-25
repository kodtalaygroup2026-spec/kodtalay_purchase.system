# kodtalay_purchase.system

ระบบจัดซื้อ/จัดจ้าง (Procurement & Purchase Order System) ของ **Kodtalay Group**

> เวอร์ชัน **0.1.0** — Scaffold เริ่มต้น (โครงสร้างโปรเจกต์ + ฐานข้อมูล + ระบบล็อกอิน)

## Tech Stack

- **Next.js 14** (App Router) + **TypeScript** (strict)
- **Supabase** — PostgreSQL + Auth + Row Level Security
- **Tailwind CSS** — UI
- **zod** — ตรวจสอบ environment variables

## โครงสร้างโปรเจกต์

```
kodtalay_purchase.system/
├── src/
│   ├── app/                 # หน้าเว็บ (App Router)
│   │   ├── layout.tsx        # layout หลัก
│   │   ├── page.tsx          # แดชบอร์ด
│   │   ├── login/page.tsx    # หน้าเข้าสู่ระบบ
│   │   └── globals.css
│   ├── components/ui/        # คอมโพเนนต์ UI ที่ใช้ซ้ำ
│   ├── lib/
│   │   ├── supabase/         # client / server / admin / middleware
│   │   ├── utils/            # ฟังก์ชันช่วยเหลือ (format ฯลฯ)
│   │   ├── constants.ts      # ค่าคงที่ + label ภาษาไทย
│   │   └── env.ts            # ตรวจสอบ env ด้วย zod
│   ├── types/                # TypeScript types ของฐานข้อมูล
│   └── middleware.ts         # refresh session + ป้องกันหน้า protected
├── supabase/
│   ├── migrations/0001_init.sql  # สคีมาฐานข้อมูลทั้งหมด + RLS
│   └── seed.sql                  # ข้อมูลตัวอย่าง
├── docs/                     # เอกสาร: ARCHITECTURE / DATABASE / API
└── ... (config: package.json, tsconfig, tailwind, next.config)
```

## เริ่มต้นใช้งาน

```bash
# 1) ติดตั้ง dependencies
npm install

# 2) ตั้งค่า environment — คัดลอกไฟล์ตัวอย่างแล้วใส่ค่าจาก Supabase
cp .env.example .env.local
# แก้ไข NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY

# 3) ติดตั้งสคีมาฐานข้อมูล (เลือกวิธีใดวิธีหนึ่ง)
#    - Supabase CLI:  supabase db push
#    - หรือคัดลอก supabase/migrations/0001_init.sql ไปรันใน SQL Editor

# 4) รันโหมดพัฒนา
npm run dev
# เปิด http://localhost:3000
```

## คำสั่งที่ใช้บ่อย

| คำสั่ง | หน้าที่ |
|---|---|
| `npm run dev` | รันเซิร์ฟเวอร์โหมดพัฒนา |
| `npm run build` | build สำหรับ production |
| `npm run lint` | ตรวจ lint |
| `npm run typecheck` | ตรวจชนิดข้อมูล (TypeScript) |

## เอกสารเพิ่มเติม

- [สถาปัตยกรรมระบบ](docs/ARCHITECTURE.md)
- [โครงสร้างฐานข้อมูล](docs/DATABASE.md)
- [API & Workflow](docs/API.md)
