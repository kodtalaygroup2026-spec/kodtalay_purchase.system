# claude.md — AI Vibe Coding Guidelines
> ไฟล์นี้ใช้กำหนดบริบทและกฎการทำงานสำหรับ AI ในการพัฒนาระบบจัดซื้อและอนุมัติการจัดซื้อ (Procurement & Approval System)

---

## #projectoverview

ระบบเว็บแอปพลิเคชันสำหรับการจัดการการจัดซื้อและอนุมัติภายในองค์กร ประกอบด้วย:

- **ชื่อโปรเจกต์:** Procurement & Approval System
- **วัตถุประสงค์:** ให้พนักงานสามารถสร้างใบขอซื้อ (Purchase Request), ส่งขออนุมัติตามลำดับชั้น, และติดตามสถานะได้แบบ real-time
- **ฟีเจอร์หลัก:**
  - สร้างและจัดการใบขอซื้อ (PR - Purchase Request)
  - ระบบอนุมัติหลายลำดับชั้น (Multi-level Approval Workflow)
  - แจ้งเตือนผ่าน LINE Notify / LINE Messaging API
  - Login ผ่าน Google OAuth
  - Responsive ใช้งานได้บน Mobile, Tablet, Notebook, PC
  - Dashboard สรุปสถานะการจัดซื้อ
  - ประวัติและรายงานการจัดซื้อ

---

## #techstack

### Frontend
- **Framework:** Next.js 14+ (App Router)
- **Language:** TypeScript
- **Styling:** Tailwind CSS + shadcn/ui
- **State Management:** Zustand หรือ React Context
- **Form Handling:** React Hook Form + Zod (validation)
- **Icons:** Lucide React

### Backend / Database
- **Database & Auth:** Supabase
  - PostgreSQL (Supabase DB)
  - Supabase Auth (Google OAuth Provider)
  - Supabase Realtime (สำหรับ live status update)
  - Supabase Storage (สำหรับไฟล์แนบ)
  - Row Level Security (RLS) บังคับทุก table

### Notification
- **LINE:** LINE Messaging API หรือ LINE Notify
  - ส่งแจ้งเตือนเมื่อมีการสร้าง PR ใหม่
  - แจ้งเตือนเมื่อถึงคิวอนุมัติ
  - แจ้งเตือนเมื่อสถานะเปลี่ยน (อนุมัติ / ปฏิเสธ)

### Hosting / Deployment
- **Platform:** Vercel (Frontend + API Routes)
- **Environment:** `.env.local` สำหรับ local, Vercel Environment Variables สำหรับ production

---

## #folderstructure

- `app/` — Next.js App Router เก็บเฉพาะ page, layout, และ API route เท่านั้น ไม่มี logic หรือ UI ในนี้
- `app/(auth)/` — Route group สำหรับหน้าที่ไม่ต้อง login เช่น หน้า login
- `app/(dashboard)/` — Route group สำหรับทุกหน้าที่ต้อง login ก่อน
- `app/api/` — API Routes ฝั่ง server เช่น auth callback และ LINE notification
- `components/` — UI component ทั้งหมด แยกตาม feature แต่ละโฟลเดอร์ แยกย่อยให้อ่านง่าย
- `components/ui/` — shadcn/ui auto-generated ห้ามแก้ไขมือ
- `components/layout/` — โครงสร้างหน้าจอหลัก เช่น Sidebar, Navbar, MobileNav
- `components/shared/` — Component ที่ใช้ซ้ำได้ทั่วระบบ ไม่ผูกกับ feature ใด
- `lib/` — Helper functions และ service functions ล้วนๆ ไม่มี React ไม่มี JSX แยกเป็น subfolder ตามหัวข้อ เช่น `supabase/`, `line/`, `utils/`
- `hooks/` — Custom React Hooks สำหรับ logic ที่ใช้ซ้ำใน component
- `types/` — TypeScript type definitions แยกไฟล์ตาม domain
- `middleware.ts` — บังคับ login ก่อนเข้าหน้า dashboard

---

## #codingrule

### ทั่วไป
- ใช้ **TypeScript** เสมอ ห้ามใช้ `any` โดยไม่มีเหตุผล
- Component ทุกตัวต้องกำหนด Props type ด้วย `interface` หรือ `type`
- ตั้งชื่อตัวแปรและฟังก์ชันเป็น **camelCase**, Component เป็น **PascalCase**, ไฟล์ component เป็น **PascalCase.tsx**
- ใช้ `const` ก่อน `let` เสมอ ห้ามใช้ `var`
- ทุก async function ต้องมี try/catch หรือ error handling

### การเขียน Code ให้อ่านง่าย (Readability First)
- **ความชัดเจนสำคัญกว่าความสั้น** — อย่าย่อ code จนอ่านไม่รู้เรื่อง แม้จะสั้นกว่า
- ตั้งชื่อตัวแปรให้สื่อความหมาย เช่น `purchaseRequestList` ดีกว่า `data`, `isSubmittingForm` ดีกว่า `loading`
- แต่ละฟังก์ชันควรทำหน้าที่เดียว (Single Responsibility) ถ้าฟังก์ชันยาวเกิน 30 บรรทัดให้แตกออก
- ใส่ comment อธิบายเมื่อ logic ไม่ชัดเจนในตัวเอง เช่น เงื่อนไขทางธุรกิจที่ซับซ้อน
- เว้นบรรทัดแบ่ง section ในไฟล์ยาว เช่น แบ่งระหว่าง state declarations, event handlers, render helpers

```tsx
// ✅ ดี — อ่านเข้าใจได้ทันที
const isUserAllowedToApprove = currentUser.role === 'manager' && pr.status === 'pending_manager'
const shouldShowApprovalPanel = isUserAllowedToApprove && !pr.isArchived

// ❌ ไม่ดี — สั้นแต่อ่านยาก
const show = u.role === 'manager' && p.s === 'pm' && !p.a
```

### การแยก Component (Component Decomposition)
- **1 ไฟล์ = 1 ความรับผิดชอบ** — ถ้า component ทำหลายอย่างให้แตกเป็นไฟล์ย่อย
- Component ที่ยาวเกิน **150 บรรทัด** ให้พิจารณาแตกออก
- ห้ามเขียน JSX ซ้อนกันลึกเกิน 4 ระดับโดยไม่แตก component
- ถ้า JSX block ใดดูเหมือน "หน่วยความหมาย" หนึ่ง (เช่น card, row, section) ให้แตกเป็น component

```tsx
// ✅ ดี — แตกออกชัดเจน
function PRDetailPage({ prId }: { prId: string }) {
  return (
    <div>
      <PRDetailHeader prId={prId} />
      <PRDetailItems prId={prId} />
      <ApprovalTimeline prId={prId} />
      <ApprovalActionPanel prId={prId} />
    </div>
  )
}

// ❌ ไม่ดี — ยัดทุกอย่างในที่เดียว
function PRDetailPage({ prId }: { prId: string }) {
  return (
    <div>
      <div className="header">
        <h1>{pr.title}</h1>
        <span className={`badge ${pr.status}`}>{pr.status}</span>
        {/* ... อีก 200 บรรทัด */}
      </div>
    </div>
  )
}
```

### การใช้ lib (Helper Functions)
- `lib/` เก็บ **pure functions และ service functions** เท่านั้น — ไม่มี React, ไม่มี JSX
- แต่ละฟังก์ชันควรอยู่คนละไฟล์หรือจัดกลุ่มตามหัวข้อที่เกี่ยวข้อง
- helper function ต้องมี input/output type ชัดเจนเสมอ
- ห้ามเรียก Supabase client โดยตรงใน component — ให้ผ่าน hook หรือ server action แทน

```ts
// ✅ ดี — lib/utils/formatCurrency.ts
export function formatCurrency(amount: number, currency: string = 'THB'): string {
  return new Intl.NumberFormat('th-TH', {
    style: 'currency',
    currency,
  }).format(amount)
}

// ✅ ดี — lib/pr/canUserApprovePR.ts
export function canUserApprovePR(user: User, pr: PurchaseRequest): boolean {
  const isManager = user.role === 'manager'
  const isPendingManagerApproval = pr.status === 'pending_manager'
  const isAssignedToUser = pr.currentApproverId === user.id

  return isManager && isPendingManagerApproval && isAssignedToUser
}
```

### กฎ "ห้ามลบ Code เดิม"
- **ห้ามลบ code ที่ไม่เข้าใจหน้าที่** — ถ้าไม่แน่ใจว่าใช้ทำอะไร ให้ comment ไว้และถามก่อน
- ถ้าต้องการแทนที่ logic เดิม ให้ comment out และ note เหตุผลไว้ก่อน ไม่ใช่ลบทิ้งเลย
- การ refactor ต้องไม่เปลี่ยน behavior — เปลี่ยนได้แค่โครงสร้าง

```ts
// ✅ ถูกต้อง — comment เหตุผลก่อนแก้
// เดิมใช้ LINE Notify (deprecated) เปลี่ยนเป็น LINE Messaging API แทน
// const response = await sendLineNotify(token, message)
const response = await sendLineMessage(channelToken, userId, message)
```

### Supabase
- ใช้ **Server Component** กับ `createServerClient` สำหรับ data fetching
- ใช้ **Client Component** กับ `createBrowserClient` เฉพาะเมื่อจำเป็น (เช่น Realtime subscription)
- ทุก query ต้องตรวจสอบ `error` จาก Supabase ก่อนใช้ `data`
- ห้าม disable RLS บน table ใดๆ ใน production
- ใช้ Supabase `generated types` จาก `database.types.ts` เสมอ

### Auth
- ใช้ Supabase Auth + Google Provider
- บังคับ login ด้วย `middleware.ts` บนทุก route ใน `(dashboard)/`
- เก็บ `user` และ `session` ผ่าน Supabase Auth Helpers เท่านั้น ห้าม localStorage

### UI / UX
- ทุกหน้าต้อง **Responsive** รองรับ breakpoint: `sm (640px)`, `md (768px)`, `lg (1024px)`, `xl (1280px)`
- ใช้ Tailwind utility classes ห้ามเขียน inline style
- Loading state ต้องแสดง Skeleton หรือ Spinner เสมอ
- Error state ต้องแสดงข้อความที่อ่านเข้าใจได้ (ไม่ใช่ error code ดิบ)
- ปุ่มทุกปุ่มที่ทำ async action ต้องมี `disabled` และ loading indicator

### LINE Notification
- ส่ง notification ผ่าน API Route (`/api/notifications/line`) เท่านั้น ห้าม call LINE API จาก client
- Payload ต้องมี: ชื่อผู้ขอ, เลขที่ PR, รายการสินค้า, มูลค่ารวม, ลิงก์ไปยังหน้า PR

---

## #command

```bash
# ติดตั้ง dependencies
npm install

# รัน development server
npm run dev

# Build สำหรับ production
npm run build

# รัน production build
npm start

# Type check
npm run type-check

# Lint
npm run lint

# Generate Supabase Types (ต้องมี Supabase CLI)
npx supabase gen types typescript --project-id <your-project-id> > types/database.types.ts

# Supabase local development
npx supabase start
npx supabase stop
npx supabase db reset        # Reset local DB
npx supabase migration new <migration-name>   # สร้าง migration ใหม่
npx supabase db push         # Push migration ไปยัง remote
```

### Environment Variables ที่ต้องมี (`.env.local`)
```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

LINE_CHANNEL_ACCESS_TOKEN=your-line-channel-access-token
```

---

## #workflow

### Git Branching
```
main          → production (deploy อัตโนมัติผ่าน Vercel)
develop       → staging / integration branch
feature/*     → ฟีเจอร์ใหม่ (เช่น feature/pr-approval-flow)
fix/*         → bug fix (เช่น fix/line-notification-error)
```

### วิธีทำงาน Feature ใหม่
1. แตก branch จาก `develop`: `git checkout -b feature/xxx`
2. พัฒนาและ commit ตาม Conventional Commits: `feat:`, `fix:`, `chore:`, `docs:`
3. Push และเปิด Pull Request เข้า `develop`
4. Review → Merge → Deploy to staging
5. เมื่อพร้อม merge `develop` → `main` เพื่อ deploy production

### Approval Workflow (Business Logic)
```
[พนักงาน] สร้าง PR
    ↓ แจ้ง LINE → หัวหน้าโดยตรง
[หัวหน้าโดยตรง] อนุมัติ / ปฏิเสธ
    ↓ ถ้าอนุมัติ + มูลค่า > threshold → แจ้ง LINE → ผู้จัดการ
[ผู้จัดการ] อนุมัติ / ปฏิเสธ
    ↓ ถ้าอนุมัติ
[ฝ่ายจัดซื้อ] รับเรื่องและดำเนินการ
    ↓
[แจ้ง LINE → ผู้ขอ] ว่าดำเนินการแล้ว
```

### Database Migration Workflow
1. เขียน SQL ใน `supabase/migrations/`
2. รัน `npx supabase db reset` บน local เพื่อทดสอบ
3. Commit migration file พร้อม code
4. รัน `npx supabase db push` เพื่อ apply บน remote

### Deployment Checklist
- [ ] ตรวจสอบ Environment Variables ครบทุกตัวใน Vercel
- [ ] รัน `npm run build` ผ่านบน local ก่อน push
- [ ] ตรวจสอบ RLS Policy บนทุก table ใน Supabase
- [ ] ทดสอบ LINE notification บน staging ก่อน production
- [ ] ทดสอบ Google Login flow บน staging
- [ ] อ่านไฟล์ที่เกี่ยวข้องก่อน
- [ ] อธิบายแผนแก้แบบสั้นๆ
- [ ] แก้เฉพาะไฟล์ที่จำเป็น
- [ ] ตรวจสอบว่าที่ทำไม่กระทบส่วนอื่น
- [ ] สรุปสิ่งที่แก้หลังทำมา