import { and, eq } from "drizzle-orm";

import { db } from "@/db/client";
import type { InstrumentExternalReference, InstrumentExternalReferenceRepository } from "@/modules/pricing/domain/instrument-external-reference";
import { toInstrumentId, type InstrumentId } from "@/modules/pricing/domain/price-observation";
import { instrumentExternalReferences } from "@/modules/instruments/infrastructure/schema";
import { NotFoundError } from "@/shared/domain/errors";
import { toUserId, type UserId } from "@/shared/domain/user-id";

type ExternalReferenceRow = typeof instrumentExternalReferences.$inferSelect;

function toDomain(row: ExternalReferenceRow): InstrumentExternalReference {
  return {
    id: row.id,
    ownerId: toUserId(row.ownerId),
    instrumentId: toInstrumentId(row.instrumentId),
    provider: row.provider,
    externalId: row.externalId,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

/**
 * Drizzle/PostgreSQL-backed `InstrumentExternalReferenceRepository`.
 *
 * `instrument_external_references` is defined alongside the instruments
 * schema (it is keyed by instrument), but pricing owns this repository
 * because provider linkage is a pricing-boundary concern (design.md
 * decision 9). No provider is implemented in this change; this repository
 * only persists the association so a future provider adapter can resolve
 * "which owned instrument is this provider result for".
 */
export const instrumentExternalReferenceRepository: InstrumentExternalReferenceRepository = {
  async upsert(
    ownerId: UserId,
    instrumentId: InstrumentId,
    provider: string,
    externalId: string,
  ): Promise<InstrumentExternalReference> {
    const [row] = await db
      .insert(instrumentExternalReferences)
      .values({ ownerId, instrumentId, provider, externalId })
      .onConflictDoUpdate({
        target: [instrumentExternalReferences.instrumentId, instrumentExternalReferences.provider],
        set: { externalId, updatedAt: new Date() },
      })
      .returning();

    return toDomain(row);
  },

  async listByInstrument(ownerId: UserId, instrumentId: InstrumentId): Promise<InstrumentExternalReference[]> {
    const rows = await db
      .select()
      .from(instrumentExternalReferences)
      .where(
        and(
          eq(instrumentExternalReferences.ownerId, ownerId),
          eq(instrumentExternalReferences.instrumentId, instrumentId),
        ),
      );

    return rows.map(toDomain);
  },

  async delete(ownerId: UserId, id: string): Promise<void> {
    const [row] = await db
      .delete(instrumentExternalReferences)
      .where(and(eq(instrumentExternalReferences.ownerId, ownerId), eq(instrumentExternalReferences.id, id)))
      .returning({ id: instrumentExternalReferences.id });

    if (!row) {
      throw new NotFoundError("Instrument external reference not found.");
    }
  },
};
