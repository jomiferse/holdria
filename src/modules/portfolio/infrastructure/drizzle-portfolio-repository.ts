import { and, eq } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";

import { db } from "@/db/client";
import * as schema from "@/db/schema";
import { isSupportedCurrency } from "@/shared/domain/currency";
import { NotFoundError } from "@/shared/domain/errors";
import type { UserId } from "@/shared/domain/user-id";
import { toPortfolioId, type Portfolio, type PortfolioId } from "../domain/portfolio";
import type { PortfolioRepository } from "../application/portfolio-repository";

/**
 * Either the runtime pool-bound `db` or a `db.transaction` callback's `tx`.
 * Mirrors the transactions module's `DbExecutor` so any module can lock or
 * read portfolio rows inside a shared transaction.
 */
type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
export type PortfolioDbExecutor = typeof db | Transaction;

type PortfolioRow = typeof schema.portfolios.$inferSelect;

function toDomain(row: PortfolioRow): Portfolio {
  if (!isSupportedCurrency(row.currency)) {
    // The database check constraint guarantees this never happens; this
    // guard only documents the invariant for the type system.
    throw new Error(`Unexpected portfolio currency: ${row.currency}`);
  }

  return {
    id: toPortfolioId(row.id),
    ownerId: row.ownerId as UserId,
    name: row.name,
    currency: row.currency,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

/**
 * Locks one owned portfolio row with `SELECT ... FOR UPDATE` inside `executor`
 * (which MUST be a `db.transaction` callback's `tx` — locking against the
 * pool-bound `db` would release the lock immediately after the statement).
 *
 * This is the serialization point for every ledger mutation (create, edit,
 * delete, contribute-and-invest): two concurrent mutations against the same
 * portfolio cannot both proceed past this call. The second transaction
 * blocks here until the first commits or rolls back, so the second always
 * replays against the first's already-committed state — preventing two
 * concurrent overspends or oversells from both passing invariant replay and
 * committing. Throws `NotFoundError` if the portfolio is not owned by
 * `ownerId`, matching the anti-enumeration behavior of the rest of the
 * owner-scoped repositories.
 */
export async function lockOwnedPortfolioForUpdate(
  executor: PortfolioDbExecutor,
  ownerId: UserId,
  id: PortfolioId,
): Promise<Portfolio> {
  const [row] = await executor
    .select()
    .from(schema.portfolios)
    .where(and(eq(schema.portfolios.ownerId, ownerId), eq(schema.portfolios.id, id)))
    .for("update")
    .limit(1);

  if (!row) {
    throw new NotFoundError("Portfolio not found");
  }
  return toDomain(row);
}

export class DrizzlePortfolioRepository implements PortfolioRepository {
  constructor(private readonly database: NodePgDatabase<typeof schema> = db) {}

  async listOwned(ownerId: UserId): Promise<Portfolio[]> {
    const rows = await this.database
      .select()
      .from(schema.portfolios)
      .where(eq(schema.portfolios.ownerId, ownerId))
      .orderBy(schema.portfolios.createdAt);

    return rows.map(toDomain);
  }

  async findOwnedById(ownerId: UserId, id: PortfolioId): Promise<Portfolio | null> {
    const [row] = await this.database
      .select()
      .from(schema.portfolios)
      .where(and(eq(schema.portfolios.ownerId, ownerId), eq(schema.portfolios.id, id)))
      .limit(1);

    return row ? toDomain(row) : null;
  }

  async create(ownerId: UserId, name: string): Promise<Portfolio> {
    const [row] = await this.database
      .insert(schema.portfolios)
      .values({ ownerId, name })
      .returning();

    return toDomain(row);
  }

  async rename(ownerId: UserId, id: PortfolioId, name: string): Promise<Portfolio | null> {
    const [row] = await this.database
      .update(schema.portfolios)
      .set({ name, updatedAt: new Date() })
      .where(and(eq(schema.portfolios.ownerId, ownerId), eq(schema.portfolios.id, id)))
      .returning();

    return row ? toDomain(row) : null;
  }

  async delete(ownerId: UserId, id: PortfolioId): Promise<boolean> {
    const rows = await this.database
      .delete(schema.portfolios)
      .where(and(eq(schema.portfolios.ownerId, ownerId), eq(schema.portfolios.id, id)))
      .returning({ id: schema.portfolios.id });

    return rows.length > 0;
  }
}

export const drizzlePortfolioRepository = new DrizzlePortfolioRepository();
