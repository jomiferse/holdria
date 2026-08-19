import { defineConfig } from "drizzle-kit";
import "dotenv/config";

/**
 * Drizzle Kit configuration for generating and applying SQL migrations.
 *
 * `drizzle-kit generate` and `drizzle-kit migrate` connect with the
 * migration-privileged role (DDL); the application's own runtime pool in
 * `src/db/client` always uses the least-privilege runtime role instead.
 */
const migrationDatabaseUrl =
  process.env.MIGRATION_DATABASE_URL ?? process.env.DATABASE_URL;

if (!migrationDatabaseUrl) {
  throw new Error(
    "MIGRATION_DATABASE_URL or DATABASE_URL must be set to run Drizzle Kit.",
  );
}

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema/index.ts",
  out: "./drizzle",
  dbCredentials: {
    url: migrationDatabaseUrl,
  },
  strict: true,
  verbose: true,
});
