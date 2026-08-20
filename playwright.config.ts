import "dotenv/config";

import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright covers the critical journeys design.md assigns it: here,
 * portfolio and instrument management (module 4/5). Fixtures sign a
 * test user in directly through Better Auth's server API (see
 * `e2e/fixtures.ts`) rather than a registration UI, which module 3
 * has not built yet.
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000",
    trace: "retain-on-failure",
  },
  webServer: {
    command: "pnpm dev",
    url: process.env.E2E_BASE_URL ?? "http://localhost:3000",
    reuseExistingServer: true,
    timeout: 60_000,
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
