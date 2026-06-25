# API & Workflow — kodtalay_purchase.system

> เวอร์ชัน 0.1.0

ระบบใช้ **Supabase client โดยตรง** (ผ่าน `@supabase/ssr`) แทนการเขียน REST API ชั้นกลางเอง
ทำให้เร็วและลดโค้ดซ้ำซ้อน — การควบคุมสิทธิ์ทำที่ฐานข้อมูลด้วย RLS
(สามารถเพิ่ม Route Handlers ใต้ `src/app/api/...` ได้ภายหลังหากต้อง logic ฝั่ง server เฉพาะ)

## 1. รูปแบบการเรียกข้อมูล (ตัวอย่าง)

```ts
// ฝั่ง Server Component
const supabase = await createClient();
const { data, error } = await supabase
  .from("purchase_orders")
  .select("*, supplier:suppliers(name)")
  .order("created_at", { ascending: false });
```

## 2. Workflow หลักของระบบจัดซื้อ

```
[ผู้ขอซื้อ] สร้างใบขอซื้อ (PR draft)
      │ submit
      ▼
[PR: submitted] ──► [ผู้อนุมัติ] อนุมัติ/ไม่อนุมัติ
      │ approved
      ▼
[PR: approved] ──► [เจ้าหน้าที่จัดซื้อ] แปลงเป็นใบสั่งซื้อ (PO)
      │                                   PR → converted
      ▼
[PO: draft] ──► อนุมัติ PO ──► ส่งให้ผู้ขาย (sent)
      │
      ▼
[รับของ] บันทึก Goods Receipt (GR)
      │  - รับครบ  → PO: received
      │  - รับบางส่วน → PO: partially_received
      ▼
[PO: closed] ปิดงาน
```

## 3. สิทธิ์ตามบทบาทในแต่ละขั้น

| ขั้นตอน | บทบาทที่ทำได้ |
|---|---|
| สร้าง/แก้ PR | requester (ของตัวเอง), admin, manager |
| อนุมัติ PR/PO | manager, admin |
| ออก/แก้ PO | purchaser, admin |
| บันทึกรับของ (GR) | purchaser, admin |
| จัดการ master data | purchaser, admin |
| ดูรายงาน audit | manager, admin |

## 4. การออกเลขเอกสาร

เรียกฟังก์ชันใน Postgres (ผ่าน RPC) เพื่อความถูกต้องแม้มีหลายคนทำพร้อมกัน:

```ts
const { data: prNumber } = await supabase.rpc("next_document_number", {
  prefix: "PR",
  table_name: "purchase_requisitions",
  column_name: "pr_number",
});
// ผลลัพธ์ตัวอย่าง: "PR-202606-0001"
```

## 5. แผนพัฒนา API/หน้าจอรอบถัดไป

- [ ] หน้า CRUD: suppliers, products
- [ ] หน้า PR: list / create / detail / submit / approve
- [ ] หน้า PO: convert from PR / approve / send
- [ ] หน้า GR: รับของ + อัปเดตสถานะ PO อัตโนมัติ (trigger)
- [ ] เขียน audit log ผ่าน admin client ใน Server Actions
- [ ] generate types อัตโนมัติด้วย `supabase gen types`
