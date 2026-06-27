/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  compress: true,
  generateBuildId: async () => `build-${Date.now()}`,
};

export default nextConfig;
