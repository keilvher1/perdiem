import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // /api/usage reads docs/reasoning-comparison.json at runtime (fs). On Vercel the function bundle only
  // contains traced files, so include it explicitly.
  outputFileTracingIncludes: {
    "/api/usage": ["./docs/reasoning-comparison.json"],
  },
};

export default nextConfig;
