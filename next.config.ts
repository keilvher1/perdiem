import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // The demo may not be framed by another site (clickjacking), and responses keep their declared types.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
    ];
  },
  // /api/usage reads docs/reasoning-comparison.json at runtime (fs). On Vercel the function bundle only
  // contains traced files, so include it explicitly.
  outputFileTracingIncludes: {
    "/api/usage": ["./docs/reasoning-comparison.json"],
  },
};

export default nextConfig;
