#!/usr/bin/env node
// Verifies that a target database's applied Drizzle migrations are
// *exactly* the ordered set this checkout's `drizzle/` history expects —
// same count, same identity (content hash), same order — before a release
// workflow is allowed to promote a deployable image tag (finding:
// "Release gating" / "Migration verification").
//
// Deliberately reuses Drizzle's own migration identity scheme rather than
// inventing a parallel one: `drizzle-orm/migrator.js`'s `readMigrationFiles`
// hashes each migration file's full raw content with sha256 and records
// that hash (plus the journal entry's `when` as `created_at`) as the
// `hash` column in `drizzle.__drizzle_migrations` when it applies that
// migration (see `drizzle-orm/pg-core/dialect.js`'s `migrate`). Comparing
// those same sha256 hashes, in the same order, against what is actually
// recorded in the target database is therefore checking exactly what
// `pnpm db:migrate` itself considers "this migration", not an
// approximation of it.
//
// Usage: MIGRATION_DATABASE_URL=postgres://... node scripts/verify-migration-set.mjs
// Exits 0 and prints "OK" if the applied set exactly matches; exits 1 with
// a diagnostic otherwise. Importable as a module (see
// `computeExpectedMigrations`/`compareMigrationSets`) for local/scripted
// testing without a real database.

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * The ordered set of migrations this checkout expects to be applied, in
 * the exact order `pnpm db:migrate` would apply them: `{ tag, hash,
 * createdAt }` per journal entry, `hash` computed identically to
 * `drizzle-orm`'s own `readMigrationFiles`.
 */
export function computeExpectedMigrations(drizzleDir = path.resolve(__dirname, "../drizzle")) {
  const journal = JSON.parse(readFileSync(path.join(drizzleDir, "meta", "_journal.json"), "utf8"));
  return journal.entries
    .slice()
    .sort((a, b) => a.when - b.when)
    .map((entry) => {
      const sql = readFileSync(path.join(drizzleDir, `${entry.tag}.sql`), "utf8");
      return {
        tag: entry.tag,
        hash: createHash("sha256").update(sql).digest("hex"),
        createdAt: entry.when,
      };
    });
}

/**
 * The ordered set of migrations actually recorded as applied against
 * `pool`, oldest first — the same ordering `drizzle-orm`'s migrator uses
 * to decide what has already run (`order by created_at`).
 */
export async function fetchAppliedMigrations(pool) {
  const { rows } = await pool.query(
    'select "hash", "created_at" as "createdAt" from drizzle.__drizzle_migrations order by created_at asc',
  );
  return rows.map((row) => ({
    hash: row.hash,
    createdAt: typeof row.createdAt === "string" ? Number(row.createdAt) : row.createdAt,
  }));
}

/**
 * Compares the expected ordered migration set against what a database
 * actually applied. Returns `{ ok: true }` only when every migration is
 * present, in the same order, with an identical content hash — i.e. the
 * database is at exactly the schema state this release expects.
 */
export function compareMigrationSets(expected, applied) {
  if (expected.length !== applied.length) {
    return {
      ok: false,
      reason:
        applied.length < expected.length
          ? `Database is missing ${expected.length - applied.length} migration(s) this release expects (expected ${expected.length}, found ${applied.length} applied).`
          : `Database has ${applied.length - expected.length} migration(s) this release does not know about (expected ${expected.length}, found ${applied.length} applied) — it may be ahead of this release.`,
    };
  }

  for (let i = 0; i < expected.length; i++) {
    if (expected[i].hash !== applied[i].hash) {
      return {
        ok: false,
        reason: `Migration set diverges at position ${i + 1} (expected "${expected[i].tag}", hash ${expected[i].hash}; database has hash ${applied[i].hash}) — order or identity does not match.`,
      };
    }
  }

  return { ok: true };
}

async function main() {
  const connectionString = process.env.MIGRATION_DATABASE_URL ?? process.env.DATABASE_URL;
  if (!connectionString) {
    console.error("MIGRATION_DATABASE_URL or DATABASE_URL must be set.");
    process.exit(1);
  }

  const { Pool } = await import("pg");
  const pool = new Pool({ connectionString });
  try {
    const expected = computeExpectedMigrations();
    const applied = await fetchAppliedMigrations(pool);
    const result = compareMigrationSets(expected, applied);

    console.log(`Expected ${expected.length} migration(s): ${expected.map((m) => m.tag).join(", ") || "(none)"}`);
    console.log(`Applied ${applied.length} migration(s) recorded in drizzle.__drizzle_migrations.`);

    if (!result.ok) {
      console.error(`::error::${result.reason}`);
      process.exit(1);
    }
    console.log("OK: applied migration set exactly matches this release's migration history.");
  } finally {
    await pool.end();
  }
}

// Only run when invoked directly (`node scripts/verify-migration-set.mjs`),
// not when imported for testing.
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
