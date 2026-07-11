import { PageLoading } from "@/components/shared/PageLoading";

// แสดงระหว่างโหลดหน้านอก dashboard (login / auth / line link) และตอนเข้าเว็บครั้งแรก
export default function Loading() {
  return <PageLoading fullScreen />;
}
