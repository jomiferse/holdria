import { and, desc, eq, lte } from "drizzle-orm";

import { db } from "@/db/client";
import { DuplicatePriceObservationError } from "@/modules/pricing/domain/errors";
import {
  parsePriceValue,
  toInstrumentId,
  toPriceObservationId,
  type InstrumentId,
  type NewPriceObservationInput,
  type PriceObservation,
  type PriceObservationEditInput,
  type PriceObservationId,
  type PriceSource,
} from "@/modules/pricing/domain/price-observation";
import type { PriceObservationRepository } from "@/modules/pricing/domain/price-observation-repository";
import { priceObservations } from "@/modules/pricing/infrastructure/schema";
import { NotFoundError } from "@/shared/domain/errors";
import { toUserId, type UserId } from "@/shared/domain/user-id";

type PriceObservationRow = typeof priceObservations.$inferSelect;

function toDomain(row: PriceObservationRow): PriceObservation {
  return {
    id: toPriceObservationId(row.id),
    ownerId: toUserId(row.ownerId),
    instrumentId: toInstrumentId(row.instrumentId),
    price: parsePriceValue(row.price),
    currency: "EUR",
    effectiveDate: row.effectiveDate,
    source: row.source as PriceSource,
    ingestedAt: row.ingestedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

/** PostgreSQL error code for a unique-constraint violation. */
const UNIQUE_VIOLATION = "23505";
/** PostgreSQL error code for a foreign-key-constraint violation. */
const FOREIGN_KEY_VIOLATION = "23503";

/**
 * Drizzle wraps the underlying `pg` driver error in a `DrizzleQueryError`
 * whose PostgreSQL error code lives on `.cause.code`, not `.code` itself;
 * this checks both so the helper works regardless of wrapping.
 */
function isPgErrorWithCode(error: unknown, code: string): boolean {
  if (typeof error !== "object" || error === null) return false;
  if ("code" in error && (error as { code?: unknown }).code === code) return true;
  const cause = (error as { cause?: unknown }).cause;
  return typeof cause === "object" && cause !== null && "code" in cause && (cause as { code?: unknown }).code === code;
}

/**
 * Drizzle/PostgreSQL-backed `PriceObservationRepository`.
 *
 * Every query is scoped by `ownerId`. The composite foreign key on
 * `price_observations(owner_id, instrument_id)` (see the table's
 * `infrastructure/schema.ts`) additionally guarantees at the database
 * level that a row can never reference another owner's instrument, even
 * if a caller supplied a spoofed `instrumentId`; that violation is
 * translated into `NotFoundError` here so it reads the same as any other
 * "not owned" outcome.
 */
export const priceObservationRepository: PriceObservationRepository = {
  async create(input: NewPriceObservationInput): Promise<PriceObservation> {
    const price = parsePriceValue(input.price);

    try {
      const [row] = await db
        .insert(priceObservations)
        .values({
          ownerId: input.ownerId,
          instrumentId: input.instrumentId,
          price: price.toFixed(8),
          currency: "EUR",
          effectiveDate: input.effectiveDate,
          source: "MANUAL",
        })
        .returning();

      return toDomain(row);
    } catch (error) {
      if (isPgErrorWithCode(error, UNIQUE_VIOLATION)) {
        throw new DuplicatePriceObservationError(input.effectiveDate);
      }
      if (isPgErrorWithCode(error, FOREIGN_KEY_VIOLATION)) {
        throw new NotFoundError("Instrument not found.");
      }
      throw error;
    }
  },

  async update(
    ownerId: UserId,
    id: PriceObservationId,
    edit: PriceObservationEditInput,
  ): Promise<PriceObservation> {
    const price = parsePriceValue(edit.price);

    try {
      const [row] = await db
        .update(priceObservations)
        .set({
          price: price.toFixed(8),
          effectiveDate: edit.effectiveDate,
          updatedAt: new Date(),
        })
        .where(and(eq(priceObservations.ownerId, ownerId), eq(priceObservations.id, id)))
        .returning();

      if (!row) {
        throw new NotFoundError("Price observation not found.");
      }

      return toDomain(row);
    } catch (error) {
      if (isPgErrorWithCode(error, UNIQUE_VIOLATION)) {
        throw new DuplicatePriceObservationError(edit.effectiveDate);
      }
      throw error;
    }
  },

  async delete(ownerId: UserId, id: PriceObservationId): Promise<void> {
    const [row] = await db
      .delete(priceObservations)
      .where(and(eq(priceObservations.ownerId, ownerId), eq(priceObservations.id, id)))
      .returning({ id: priceObservations.id });

    if (!row) {
      throw new NotFoundError("Price observation not found.");
    }
  },

  async findOwnedById(ownerId: UserId, id: PriceObservationId): Promise<PriceObservation | null> {
    const [row] = await db
      .select()
      .from(priceObservations)
      .where(and(eq(priceObservations.ownerId, ownerId), eq(priceObservations.id, id)))
      .limit(1);

    return row ? toDomain(row) : null;
  },

  async listByInstrument(ownerId: UserId, instrumentId: InstrumentId): Promise<PriceObservation[]> {
    const rows = await db
      .select()
      .from(priceObservations)
      .where(and(eq(priceObservations.ownerId, ownerId), eq(priceObservations.instrumentId, instrumentId)))
      .orderBy(desc(priceObservations.effectiveDate));

    return rows.map(toDomain);
  },

  async findLatestAsOf(
    ownerId: UserId,
    instrumentId: InstrumentId,
    asOfDate: string,
  ): Promise<PriceObservation | null> {
    const [row] = await db
      .select()
      .from(priceObservations)
      .where(
        and(
          eq(priceObservations.ownerId, ownerId),
          eq(priceObservations.instrumentId, instrumentId),
          lte(priceObservations.effectiveDate, asOfDate),
        ),
      )
      .orderBy(desc(priceObservations.effectiveDate))
      .limit(1);

    return row ? toDomain(row) : null;
  },
};
