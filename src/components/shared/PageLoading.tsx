// ===========================================================================
// File: src/components/shared/PageLoading.tsx
// คำอธิบาย: หน้าจอ loading จาง ๆ ระหว่างสลับหน้า — "loading" + จุดสว่างสลับกัน
//           เป็น server component ล้วน (ไม่มี hook) ใช้ CSS animation อย่างเดียว
// ===========================================================================

interface PageLoadingProps {
  /** true = เต็มจอ (หน้านอก dashboard), false = เต็มพื้นที่เนื้อหา */
  fullScreen?: boolean;
}

export function PageLoading({ fullScreen = false }: PageLoadingProps) {
  return (
    <div
      className={`flex ${fullScreen ? "min-h-screen" : "min-h-[60vh]"} w-full flex-col items-center justify-center`}
    >
      <div className="flex items-end gap-2 text-slate-400/80">
        <span className="text-sm font-medium tracking-wide">loading</span>
        <span className="flex items-center gap-1 pb-[3px]">
          <span className="loading-dot h-1.5 w-1.5 rounded-full bg-slate-400" />
          <span className="loading-dot h-1.5 w-1.5 rounded-full bg-slate-400" />
          <span className="loading-dot h-1.5 w-1.5 rounded-full bg-slate-400" />
        </span>
      </div>
    </div>
  );
}
