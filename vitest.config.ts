import path from "node:path";
import { fileURLToPath } from "node:url";

import { config as loadEnv } from "dotenv";
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

const rootDir = path.dirname(fileURLToPath(import.meta.url));

// A handful of unit tests exercise identity infrastructure modules (e.g.
// `auth.ts`) that read `@/config/env` at import time. Loading the local
// `.env` here (mirroring Next.js's own auto-loading) keeps that env
// validation satisfied without requiring a database connection — no test
// in this config talks to PostgreSQL.
loadEnv({ path: path.resolve(rootDir, ".env") });

/**
 * Vitest covers pure domain, application, and infrastructure code (see
 * design.md "Test by architectural risk"). Files are resolved through the
 * same `@/*` -> `src/*` alias as `tsconfig.json` so test imports match
 * application code.
 *
 * PostgreSQL-backed integration tests live in a separate config
 * (`vitest.integration.config.ts`, `pnpm test:integration`) rather than
 * here, so the default `pnpm test` never depends on a running database.
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
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    exclude: ["src/**/*.integration.test.ts"],
  },
});
