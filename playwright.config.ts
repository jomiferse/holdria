import path from "node:path";
import { fileURLToPath } from "node:url";

import { config as loadEnv } from "dotenv";
import { defineConfig, devices } from "@playwright/test";

const rootDir = path.dirname(fileURLToPath(import.meta.url));

// The Playwright-driven app instance runs against the dedicated
// `holdria_test` PostgreSQL database (see `.env.test` / task 1.5), never a
// developer's local `holdria` database or a production account.
loadEnv({ path: path.resolve(rootDir, ".env.test"), override: true });

const PORT = 3100;
const baseURL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false, // shared PostgreSQL database across test files
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"]],
  use: {
    baseURL,
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    // Runs the same standalone entry point the Dockerfile ships (`next
    // start` warns that it does not support `output: standalone`). The
    // standalone server expects `.next/static` and `public` copied
    // alongside it, exactly as the Dockerfile's COPY steps do.
    command:
      "pnpm build && " +
      "cp -r .next/static .next/standalone/.next/static && " +
      "cp -r public .next/standalone/public && " +
      "node .next/standalone/server.js",
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    env: {
      ...process.env,
      PORT: String(PORT),
      // Next's standalone server binds to `process.env.HOSTNAME` when
      // set, which otherwise inherits the host machine's system hostname
      // from the shell environment and becomes unreachable at
      // `localhost`.
      HOSTNAME: "0.0.0.0",
      BETTER_AUTH_URL: baseURL,
      TRUSTED_ORIGINS: baseURL,
      // The E2E suite signs many real users up and in from one host in a
      // short window — legitimate test traffic, not the credential-
      // stuffing/abuse pattern the production rate limit defends against
      // (see `env.DISABLE_AUTH_RATE_LIMIT`).
      DISABLE_AUTH_RATE_LIMIT: "true",
    },
  },
});
