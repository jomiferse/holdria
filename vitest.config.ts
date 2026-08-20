import "dotenv/config";
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

/**
 * Vitest covers pure domain, application, and infrastructure code (see
 * design.md "Test by architectural risk"). `dotenv/config` loads `.env` so
 * `*.integration.test.ts` files can reach the PostgreSQL instance
 * described by `DATABASE_URL` (see `docker-compose.yml`) the same way the
 * application does. Those files require a running, migrated database and
 * fail loudly (not silently skip) when one is not reachable.
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
