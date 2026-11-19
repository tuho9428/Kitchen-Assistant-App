import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "tests/e2e",
  workers: 1,
  fullyParallel: false,
  timeout: 45000,
  use: {
    baseURL: "http://127.0.0.1:3100",
    channel: "chrome",
    headless: true,
    trace: "retain-on-failure",
  },
  webServer: [
    {
      command: "npx tsx tests/fixtures/gateway.ts",
      url: "http://127.0.0.1:54329/health",
      reuseExistingServer: !process.env.CI,
      timeout: 30000,
    },
    {
      command: "node tests/fixtures/start-app.mjs",
      url: "http://127.0.0.1:3100",
      reuseExistingServer: !process.env.CI,
      timeout: 180000,
      env: {
        KITCHEN_TEST_BUILD: "1",
        DATABASE_URL: "postgresql://test:test@localhost/test",
        NEON_TEST_ENDPOINT: "http://127.0.0.1:54329/sql",
      },
    },
  ],
});
