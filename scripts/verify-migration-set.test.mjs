// Local/scripted tests for `verify-migration-set.mjs`'s migration-set
// comparison — no test framework dependency (this directory is release
// tooling, not application code), just `node --test`.
//
// Run: node --test scripts/
// Or, with an already-migrated database available (see `.env.test`):
//   MIGRATION_DATABASE_URL=postgresql://... node --test scripts/

import assert from "node:assert/strict";
import { test } from "node:test";

import { compareMigrationSets, computeExpectedMigrations, fetchAppliedMigrations } from "./verify-migration-set.mjs";

function migration(tag, hash, createdAt) {
  return { tag, hash, createdAt };
}

test("compareMigrationSets: exact match", () => {
  const expected = [migration("0000_a", "hash-a", 1), migration("0001_b", "hash-b", 2)];
  const applied = [migration("0000_a", "hash-a", 1), migration("0001_b", "hash-b", 2)];
  assert.deepEqual(compareMigrationSets(expected, applied), { ok: true });
});

test("compareMigrationSets: fails when a required migration is missing", () => {
  const expected = [migration("0000_a", "hash-a", 1), migration("0001_b", "hash-b", 2)];
  const applied = [migration("0000_a", "hash-a", 1)];
  const result = compareMigrationSets(expected, applied);
  assert.equal(result.ok, false);
  assert.match(result.reason, /missing 1 migration/i);
});

test("compareMigrationSets: fails when an unexpected extra migration is present", () => {
  const expected = [migration("0000_a", "hash-a", 1)];
  const applied = [migration("0000_a", "hash-a", 1), migration("0001_b", "hash-b", 2)];
  const result = compareMigrationSets(expected, applied);
  assert.equal(result.ok, false);
  assert.match(result.reason, /does not know about/i);
});

test("compareMigrationSets: fails when migration identity (hash) does not match at the same position", () => {
  const expected = [migration("0000_a", "hash-a", 1)];
  const applied = [migration("0000_a", "a-different-hash", 1)];
  const result = compareMigrationSets(expected, applied);
  assert.equal(result.ok, false);
  assert.match(result.reason, /diverges at position 1/i);
  assert.match(result.reason, /0000_a/);
});

test("compareMigrationSets: fails when migration order does not match, even with the same set of hashes", () => {
  const expected = [migration("0000_a", "hash-a", 1), migration("0001_b", "hash-b", 2)];
  // Same two hashes, swapped order — a real divergence (finding requires
  // order to match, not just set membership).
  const applied = [migration("0001_b", "hash-b", 2), migration("0000_a", "hash-a", 1)];
  const result = compareMigrationSets(expected, applied);
  assert.equal(result.ok, false);
  assert.match(result.reason, /diverges at position 1/i);
});

test("compareMigrationSets: an empty database against an empty release history is a match", () => {
  assert.deepEqual(compareMigrationSets([], []), { ok: true });
});

test("computeExpectedMigrations: reads this checkout's real migration history and hashes it", () => {
  const expected = computeExpectedMigrations();
  assert.ok(expected.length >= 3, "expected at least the 3 migrations this repository ships");
  for (const migration of expected) {
    assert.match(migration.hash, /^[0-9a-f]{64}$/, `${migration.tag} should have a sha256 hex hash`);
  }
  // Ascending by journal `when`, matching apply order.
  for (let i = 1; i < expected.length; i++) {
    assert.ok(expected[i].createdAt >= expected[i - 1].createdAt);
  }
});

// End-to-end check against a real database, only when one is configured
// (mirrors the release workflow's own environment-gated `migrate` job).
// Skips rather than fails when no connection is available, since this
// file is meant to be runnable without any infrastructure for the pure
// `compareMigrationSets` cases above.
test("end-to-end: an already-migrated real database matches this checkout's migration history", async (t) => {
  const connectionString = process.env.MIGRATION_DATABASE_URL ?? process.env.DATABASE_URL;
  if (!connectionString) {
    t.skip("MIGRATION_DATABASE_URL/DATABASE_URL not set — skipping the real-database check");
    return;
  }

  const { Pool } = await import("pg");
  const pool = new Pool({ connectionString });
  try {
    const expected = computeExpectedMigrations();
    const applied = await fetchAppliedMigrations(pool);
    const result = compareMigrationSets(expected, applied);
    assert.deepEqual(result, { ok: true }, result.reason);
  } finally {
    await pool.end();
  }
});
