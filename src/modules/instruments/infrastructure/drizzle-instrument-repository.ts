import { and, eq } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import type { DatabaseError } from "pg";

import { db } from "@/db/client";
import * as schema from "@/db/schema";
import { isSupportedCurrency } from "@/shared/domain/currency";
import type { UserId } from "@/shared/domain/user-id";
import {
  isSupportedInstrumentType,
  toInstrumentId,
  type Instrument,
  type InstrumentId,
  type NormalizedInstrumentInput,
} from "../domain/instrument";
import { DuplicateIsinError, InstrumentReferencedError } from "../domain/errors";
import type { InstrumentRepository } from "../application/instrument-repository";

type InstrumentRow = typeof schema.instruments.$inferSelect;

// PostgreSQL error codes (see https://www.postgresql.org/docs/current/errcodes-appendix.html).
const UNIQUE_VIOLATION = "23505";
const FOREIGN_KEY_VIOLATION = "23503";
const ISIN_UNIQUE_CONSTRAINT = "instruments_owner_id_isin_key";

function isDatabaseError(error: unknown): error is DatabaseError {
  return typeof error === "object" && error !== null && "code" in error;
}

/** Drizzle wraps the underlying `pg` error in a `DrizzleQueryError`, with the code/constraint-bearing error on `.cause`. */
function toDatabaseError(error: unknown): DatabaseError | undefined {
  if (isDatabaseError(error)) return error;
  if (error instanceof Error && isDatabaseError(error.cause)) return error.cause;
  return undefined;
}

function toDomain(row: InstrumentRow): Instrument {
  if (!isSupportedInstrumentType(row.type) || !isSupportedCurrency(row.currency)) {
    // The database check constraints guarantee this never happens; this
    // guard only documents the invariant for the type system.
    throw new Error(`Unexpected instrument row shape: type=${row.type} currency=${row.currency}`);
  }

  return {
    id: toInstrumentId(row.id),
    ownerId: row.ownerId as UserId,
    type: row.type,
    name: row.name,
    isin: row.isin,
    ticker: row.ticker,
    market: row.market,
    currency: row.currency,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export class DrizzleInstrumentRepository implements InstrumentRepository {
  constructor(private readonly database: NodePgDatabase<typeof schema> = db) {}

  async listOwned(ownerId: UserId): Promise<Instrument[]> {
    const rows = await this.database
      .select()
      .from(schema.instruments)
      .where(eq(schema.instruments.ownerId, ownerId))
      .orderBy(schema.instruments.name);

    return rows.map(toDomain);
  }

  async findOwnedById(ownerId: UserId, id: InstrumentId): Promise<Instrument | null> {
    const [row] = await this.database
      .select()
      .from(schema.instruments)
      .where(and(eq(schema.instruments.ownerId, ownerId), eq(schema.instruments.id, id)))
      .limit(1);

    return row ? toDomain(row) : null;
  }

  async findOwnedByIsin(ownerId: UserId, isin: string): Promise<Instrument | null> {
    const [row] = await this.database
      .select()
      .from(schema.instruments)
      .where(and(eq(schema.instruments.ownerId, ownerId), eq(schema.instruments.isin, isin)))
      .limit(1);

    return row ? toDomain(row) : null;
  }

  async create(ownerId: UserId, input: NormalizedInstrumentInput): Promise<Instrument> {
    try {
      const [row] = await this.database
        .insert(schema.instruments)
        .values({
          ownerId,
          type: input.type,
          name: input.name,
          isin: input.isin,
          ticker: input.ticker,
          market: input.market,
        })
        .returning();

      return toDomain(row);
    } catch (error) {
      throw await this.mapWriteError(ownerId, input, error);
    }
  }

  async update(ownerId: UserId, id: InstrumentId, input: NormalizedInstrumentInput): Promise<Instrument | null> {
    try {
      const [row] = await this.database
        .update(schema.instruments)
        .set({
          type: input.type,
          name: input.name,
          isin: input.isin,
          ticker: input.ticker,
          market: input.market,
          updatedAt: new Date(),
        })
        .where(and(eq(schema.instruments.ownerId, ownerId), eq(schema.instruments.id, id)))
        .returning();

      return row ? toDomain(row) : null;
    } catch (error) {
      throw await this.mapWriteError(ownerId, input, error);
    }
  }

  async delete(ownerId: UserId, id: InstrumentId): Promise<boolean> {
    try {
      const rows = await this.database
        .delete(schema.instruments)
        .where(and(eq(schema.instruments.ownerId, ownerId), eq(schema.instruments.id, id)))
        .returning({ id: schema.instruments.id });

      return rows.length > 0;
    } catch (error) {
      const dbError = toDatabaseError(error);
      if (dbError?.code === FOREIGN_KEY_VIOLATION) {
        throw new InstrumentReferencedError();
      }
      throw error;
    }
  }

  /** Translates a duplicate-ISIN constraint violation into `DuplicateIsinError`, pointing at the existing row. */
  private async mapWriteError(
    ownerId: UserId,
    input: NormalizedInstrumentInput,
    error: unknown,
  ): Promise<unknown> {
    const dbError = toDatabaseError(error);
    if (dbError?.code === UNIQUE_VIOLATION && dbError.constraint === ISIN_UNIQUE_CONSTRAINT && input.isin) {
      const existing = await this.findOwnedByIsin(ownerId, input.isin);
      if (existing) {
        return new DuplicateIsinError(existing.id);
      }
    }
    return error;
  }
}

export const drizzleInstrumentRepository = new DrizzleInstrumentRepository();
