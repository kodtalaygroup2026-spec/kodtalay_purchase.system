# โครงสร้างฐานข้อมูล (Database Design) — kodtalay_purchase.system

> เวอร์ชัน 0.1.0 · ไฟล์สคีมา: `supabase/migrations/0001_init.sql`

## 1. แผนผังความสัมพันธ์ (ER Overview)

```
auth.users ──1:1── profiles
                      │ (requester_id / created_by / approver_id ...)
                      ▼
suppliers ──1:N── purchase_orders ◄──N:1── purchase_requisitions ──1:N── pr_items
                      │ 1:N                         │
                      ▼                             └── (requester_id) profiles
                  po_items ──1:N── gr_items ──N:1── goods_receipts
                                                         │ N:1
categories ──1:N── products                              ▼ po
                                                   purchase_orders

approvals  (polymorphic: document_type = 'PR' | 'PO', document_id)
audit_logs (บันทึกการกระทำทั้งระบบ)
```

## 2. ตารางหลัก

| ตาราง | หน้าที่ | คีย์สำคัญ |
|---|---|---|
| `profiles` | ข้อมูลผู้ใช้ + บทบาท (เชื่อม auth.users) | `id` = auth user id |
| `suppliers` | ผู้ขาย/คู่ค้า | `code` unique |
| `categories` / `products` | หมวดหมู่และแคตตาล็อกสินค้า | `sku` unique |
| `purchase_requisitions` / `pr_items` | ใบขอซื้อ (PR) + รายการย่อย | `pr_number` unique |
| `purchase_orders` / `po_items` | ใบสั่งซื้อ (PO) + รายการย่อย | `po_number` unique |
| `approvals` | บันทึกการอนุมัติหลายขั้น (PR/PO) | `(document_type, document_id)` |
| `goods_receipts` / `gr_items` | ใบรับของ (GR) + รายการย่อย | `gr_number` unique |
| `audit_logs` | ประวัติการกระทำเพื่อตรวจสอบ | `entity, entity_id` |

## 3. สถานะเอกสาร (Enums)

- **PR (`pr_status`)**: draft → submitted → approved/rejected → converted / cancelled
- **PO (`po_status`)**: draft → pending_approval → approved → sent → partially_received → received → closed / cancelled
- **บทบาท (`user_role`)**: admin, manager, purchaser, requester, viewer

## 4. กลไกอัตโนมัติ

- **`set_updated_at()`** — trigger อัปเดต `updated_at` ทุกครั้งที่แก้แถว
- **`handle_new_user()`** — สร้าง `profiles` อัตโนมัติเมื่อมีผู้สมัครใหม่
- **`next_document_number(prefix, table, column)`** — ออกเลขเอกสารรูปแบบ `PR-202606-0001`
  พร้อม advisory lock กันเลขซ้ำเมื่อมีหลาย transaction พร้อมกัน
- **`line_total`** — generated column = `quantity * unit_price`

## 5. ความปลอดภัยระดับแถว (RLS)

เปิด RLS ทุกตาราง โดยหลักการ:
- ผู้ใช้ต้อง **ล็อกอิน** (`authenticated`) จึงอ่านข้อมูลได้
- **master data** (suppliers/products/categories) แก้ไขได้เฉพาะ `admin`/`purchaser`
- **PR** ผู้ขอแก้ของตัวเองได้ / `admin`,`manager` จัดการได้ทั้งหมด
- **PO, GR** จัดการได้เฉพาะ `admin`/`purchaser`
- **audit_logs** อ่านได้เฉพาะ `admin`/`manager`, เขียนผ่าน service role เท่านั้น

## 6. การติดตั้งสคีมา

```bash
# วิธีที่ 1: ใช้ Supabase CLI
supabase db push

# วิธีที่ 2: คัดลอกเนื้อหา 0001_init.sql ไปวางใน
# Supabase Dashboard > SQL Editor > Run
# จากนั้น (ตัวเลือก) รัน seed.sql เพื่อใส่ข้อมูลตัวอย่าง
```
