import type { NextConfig } from "next";
const config: NextConfig = {
  logging: { serverFunctions: false },
  experimental: { staleTimes: { dynamic: 0, static: 3600 } },
  // Development, production and browser tests must not overwrite each other.
  distDir:
    process.env.KITCHEN_TEST_BUILD === "1"
      ? ".next-e2e"
      : process.env.NODE_ENV === "development"
        ? ".next-dev"
        : ".next",
  async headers() {
    return [
      {
        source: "/sw.js",
        headers: [
          {
            key: "Cache-Control",
            value: "no-cache, no-store, must-revalidate",
          },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "same-origin" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Robots-Tag", value: "noindex, nofollow" },
        ],
      },
    ];
  },
};
export default config;
