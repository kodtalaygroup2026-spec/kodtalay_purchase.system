/** @type {import('next').NextConfig} */
const nextConfig = {
  // เปิด strict mode ของ React เพื่อจับ bug ตั้งแต่ตอน dev
  reactStrictMode: true,
  // ลดข้อมูลที่รั่วไหลผ่าน header (security hardening)
  poweredByHeader: false,
  // บีบอัด response เพื่อความเร็ว
  compress: true,
  experimental: {
    // จำกัด package ที่ optimize import เพื่อให้ bundle เล็กและโหลดเร็ว
    optimizePackageImports: ["@supabase/supabase-js"],
  },
};

export default nextConfig;
