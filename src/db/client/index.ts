import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";

import { env } from "@/config/env";
import * as schema from "@/db/schema";

/**
 * Runtime PostgreSQL connection pool.
 *
 * Uses the least-privilege runtime database role (DML only; see
 * `drizzle/roles.sql`). DDL and migrations always go through the separate
 * migration-privileged connection in `drizzle.config.ts`, never through
 * this pool.
 *
 * The pool is sized for a small number of persistent Node.js container
 * replicas, not for a serverless/edge deployment. `max` bounds concurrent
 * connections so the application cannot exhaust PostgreSQL's connection
 * limit under load; `idleTimeoutMillis` releases idle connections back to
 * the database between traffic bursts.
 */
const pool = new Pool({
  connectionString: env.DATABASE_URL,
  max: 10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 10_000,
});

pool.on("error", (error) => {
  // Idle clients can emit background errors (e.g. a dropped network
  // connection) outside of any query. Surfacing them here keeps the
  // process from crashing while still making the failure observable.
  console.error("Unexpected PostgreSQL pool error", error);
});

/**
 * Drizzle ORM query builder bound to the runtime pool, with PostgreSQL
 * `numeric` columns kept as strings (see `src/db/schema`) so downstream
 * code always converts them into `decimal.js` values instead of the
 * imprecise JavaScript `number` type.
 */
export const db = drizzle(pool, { schema });

/** Reports whether the runtime pool can reach PostgreSQL. Used by the readiness endpoint. */
export async function checkDatabaseConnection(): Promise<boolean> {
  try {
    await pool.query("SELECT 1");
    return true;
  } catch {
    return false;
  }
}

/** Closes the pool gracefully. Called on process shutdown signals. */
export async function closeDatabaseConnection(): Promise<void> {
  await pool.end();
}
