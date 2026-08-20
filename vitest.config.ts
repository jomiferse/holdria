import "dotenv/config";

import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

/**
 * Vitest covers pure domain, application, and infrastructure code (see
 * design.md "Test by architectural risk"). PostgreSQL integration test
 * files (co-located as `*.test.ts` next to the Drizzle repository they
 * exercise) self-skip when `DATABASE_URL` is unset, so a plain `pnpm
 * test` stays runnable without a database; loading `.env` here only
 * lets them find a local one when it is available, matching
 * `drizzle.config.ts`.
 */
export default defineConfig({
  plugins: [react()],
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
  },
});
