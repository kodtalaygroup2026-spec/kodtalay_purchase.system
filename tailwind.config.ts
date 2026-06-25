import type { Config } from "tailwindcss";

// การตั้งค่า Tailwind CSS สำหรับ UI ของระบบจัดซื้อ
const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: "#1e40af", // สีหลักของแบรนด์ (น้ำเงิน)
          dark: "#1e3a8a",
          light: "#3b82f6",
        },
      },
    },
  },
  plugins: [],
};

export default config;
