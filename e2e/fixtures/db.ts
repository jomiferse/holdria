import { Pool } from "pg";

/**
 * Direct PostgreSQL access for Playwright fixtures only — the browser and
 * the app under test never see these credentials. Used to flip
 * `emailVerified` after a fixture-created sign-up so tests that are not
 * themselves about the verification flow don't have to read a real inbox,
 * and to read Better Auth's own tables when a test needs to assert
 * database state directly (e.g. account-deletion cascades).
 *
 * Points at `holdria_test` via `DATABASE_URL`, loaded from `.env.test` in
 * `playwright.config.ts`.
 */
export const testDbPool = new Pool({ connectionString: process.env.DATABASE_URL });

export async function markEmailVerified(email: string): Promise<void> {
  await testDbPool.query('update "user" set email_verified = true where email = $1', [email]);
}

export async function findUserByEmail(email: string): Promise<{ id: string } | null> {
  const result = await testDbPool.query('select id from "user" where email = $1', [email]);
  return result.rows[0] ?? null;
}
