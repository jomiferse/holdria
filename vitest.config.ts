import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import "dotenv/config";

/**
 * Vitest covers pure domain, application, and infrastructure code (see
 * design.md "Test by architectural risk"). PostgreSQL integration tests
 * additionally require a running database; wire their setup/teardown here
 * once the first integration suite lands (module 2/3 work), rather than
 * adding an unused database dependency to every unit test run now.
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
