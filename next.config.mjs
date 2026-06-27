/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  compress: true,
  // ปิด webpack filesystem cache เพื่อป้องกัน stale route (link-code) จาก Vercel cache
  webpack: (config) => {
    config.cache = false;
    return config;
  },
};

export default nextConfig;
