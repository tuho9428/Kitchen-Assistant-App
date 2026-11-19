import type { NextConfig } from "next";
const config: NextConfig = {
  // Keep production output separate from browser-test development workers.
  distDir: process.env.KITCHEN_TEST_BUILD === "1" ? ".next-e2e" : ".next",
  async headers() {
    return [
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
