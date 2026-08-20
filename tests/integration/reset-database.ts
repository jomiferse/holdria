import { sql } from "drizzle-orm";

import { db } from "@/db/client";

/**
 * Empties every application and Better Auth table between integration
 * tests so each test starts from a clean database without re-running
 * migrations. Deletes from `"user"` and relies on the `ON DELETE CASCADE`
 * foreign keys every owned table already carries (sessions, accounts,
 * portfolios, instruments, ledger entries, price observations) instead of
 * truncating each table directly — the least-privilege `holdria_app` role
 * used for integration tests has DELETE but not TRUNCATE (see
 * `drizzle/roles.sql`). `verification` and `rate_limit` are not
 * user-owned foreign keys, so they are cleared explicitly.
 *
 * Test files run sequentially against the shared `holdria_test` database
 * (`vitest.integration.config.ts`'s `fileParallelism: false`), so a single
 * reset between tests is sufficient isolation.
 */
export async function resetDatabase(): Promise<void> {
  await db.execute(sql`delete from "user"`);
  await db.execute(sql`delete from "verification"`);
  await db.execute(sql`delete from "rate_limit"`);
}
