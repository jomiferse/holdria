import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";

import { Pool, type PoolClient } from "pg";
import { afterEach, describe, expect, it } from "vitest";

import { migrationDatabaseUrl } from "@/config/env";

/**
 * Proves migration 0002 is forward-safe (finding: "Unsafe migration 0002" /
 * tasks.md 2.7): starting from the schema state migrations 0000 and 0001
 * leave behind — the previous migration state, with a real Better Auth
 * user/account row already present — applying 0002 must succeed and
 * correctly backfill every existing row, rather than failing outright the
 * way a direct `ADD COLUMN ... NOT NULL` would against a non-empty
 * `account` table.
 *
 * Runs the actual versioned migration files (0000, 0001, 0002) inside a
 * scratch PostgreSQL schema — not a scratch database, since the
 * least-privilege `holdria_migrator` role (drizzle/roles.sql) is not
 * granted `CREATEDB` — dropped again at the end of the test. The migration
 * files hardcode `"public".` schema qualifiers for foreign-key references
 * (Drizzle Kit's default output), so those are rewritten to the scratch
 * schema's name before executing; the statements themselves are otherwise
 * byte-for-byte what `pnpm db:migrate` would run.
 */

const drizzleDir = path.resolve(__dirname, "../../drizzle");

function readMigrationStatements(fileName: string, schema: string): string[] {
  const raw = readFileSync(path.join(drizzleDir, fileName), "utf8");
  const scoped = raw.replaceAll('"public".', `"${schema}".`);
  return scoped
    .split("--> statement-breakpoint")
    .map((statement) => statement.trim())
    .filter((statement) => statement.length > 0);
}

const ddlPool = new Pool({ connectionString: migrationDatabaseUrl() });
let client: PoolClient | undefined;
let schemaName: string | undefined;

afterEach(async () => {
  if (client) {
    if (schemaName) {
      await client.query(`DROP SCHEMA IF EXISTS "${schemaName}" CASCADE`);
    }
    client.release();
    client = undefined;
  }
  schemaName = undefined;
});

describe("migration 0002 upgrade path", () => {
  it("succeeds against an existing Better Auth user/account row instead of failing on the NOT NULL add", async () => {
    schemaName = `upgrade_test_${randomUUID().replaceAll("-", "")}`;
    client = await ddlPool.connect();

    await client.query(`CREATE SCHEMA "${schemaName}"`);
    await client.query(`SET search_path TO "${schemaName}"`);

    for (const statement of readMigrationStatements("0000_old_unus.sql", schemaName)) {
      await client.query(statement);
    }
    for (const statement of readMigrationStatements("0001_low_mattie_franklin.sql", schemaName)) {
      await client.query(statement);
    }

    // The previous migration state: a real user and a real credential
    // account row, exactly as an already-deployed database would have
    // before ever seeing 0002 — no "issuer" column exists yet.
    const userId = randomUUID();
    const accountId = randomUUID();
    await client.query(
      `INSERT INTO "user" (id, name, email, email_verified) VALUES ($1, 'Existing User', 'existing-user@example.test', true)`,
      [userId],
    );
    await client.query(
      `INSERT INTO "account" (id, account_id, provider_id, user_id, password) VALUES ($1, $2, 'credential', $3, 'hashed-password')`,
      [accountId, userId, userId],
    );

    // This is the statement under test: on the unsafe version of 0002 (a
    // direct `ADD COLUMN "issuer" text NOT NULL`), this would reject with
    // a NOT NULL violation because the row inserted above already exists.
    for (const statement of readMigrationStatements("0002_crazy_the_anarchist.sql", schemaName)) {
      await client.query(statement);
    }

    const { rows } = await client.query(`SELECT provider_id, issuer FROM "account" WHERE id = $1`, [accountId]);
    expect(rows).toHaveLength(1);
    expect(rows[0].provider_id).toBe("credential");
    // Backfilled to Better Auth's own local-issuer convention
    // (`createLocalAccountIssuer` — see the migration file's comment).
    expect(rows[0].issuer).toBe("local:credential");

    // The column is genuinely NOT NULL after the migration, not just
    // backfilled for pre-existing rows.
    const newAccountId = randomUUID();
    await expect(
      client.query(
        `INSERT INTO "account" (id, account_id, provider_id, user_id, password, issuer) VALUES ($1, $2, 'credential', $3, 'x', NULL)`,
        [newAccountId, newAccountId, userId],
      ),
    ).rejects.toThrow(/null value|not-null/i);
  });
});
