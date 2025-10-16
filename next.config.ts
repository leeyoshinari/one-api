import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  eslint: {
    ignoreDuringBuilds: true, // 让 Vercel 构建时跳过 ESLint 检查
  },
};

export default nextConfig;
