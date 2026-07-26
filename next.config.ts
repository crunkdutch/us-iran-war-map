import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Force consistent build to avoid Vercel's Turbopack cache issues
  experimental: {
    turbo: {},
  },
};

export default nextConfig;
