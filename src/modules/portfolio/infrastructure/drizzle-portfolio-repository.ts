import { and, eq } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";

import { db } from "@/db/client";
import * as schema from "@/db/schema";
import { isSupportedCurrency } from "@/shared/domain/currency";
import type { UserId } from "@/shared/domain/user-id";
import { toPortfolioId, type Portfolio, type PortfolioId } from "../domain/portfolio";
import type { PortfolioRepository } from "../application/portfolio-repository";

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
