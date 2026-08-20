import path from "node:path";
import { fileURLToPath } from "node:url";

import { config as loadEnv } from "dotenv";
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

const rootDir = path.dirname(fileURLToPath(import.meta.url));

// Loaded here (at config-evaluation time, before any Vitest worker starts)
// so `src/config/env.ts`'s module-level validation — imported transitively
// by `src/db/client` and `auth.ts` — sees the test database connection
// instead of requiring a separate `.env`-reading indirection layer.
loadEnv({ path: path.resolve(rootDir, ".env.test"), override: true });

/**
 * PostgreSQL-backed integration tests (task 1.5): Better Auth's Drizzle
 * schema, session resolution, ownership constraints, transactions, and
 * account-deletion cascades against a real `holdria_test` database (see
 * `.env.test` and `docker-compose.yml`'s `postgres` service).
 *
 * Kept separate from `vitest.config.ts` so `pnpm test` (unit tests) never
 * requires a running database; run these with `pnpm test:integration`.
 * Test files run one at a time (`fileParallelism: false`) because they
 * share one physical database and reset it between tests.
 */
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(rootDir, "./src"),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.integration.test.ts"],
    fileParallelism: false,
    testTimeout: 20_000,
    hookTimeout: 20_000,
  },
});
