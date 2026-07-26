import type { NextConfig } from "next";
import { execSync } from "child_process";

const nextConfig: NextConfig = {
  generateBuildId: async () =>
    execSync("git rev-parse --short HEAD").toString().trim(),
};

export default nextConfig;
