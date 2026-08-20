import { eq } from "drizzle-orm";

import { db } from "@/db/client";
import { toInstrumentId, type InstrumentId } from "@/modules/pricing/domain/price-observation";
import { instruments } from "@/modules/instruments/infrastructure/schema";
import type { UserId } from "@/shared/domain/user-id";

/** The minimal instrument fields pricing's UI needs for selection and display. */
export interface OwnedInstrumentSummary {
  readonly id: InstrumentId;
  readonly name: string;
  readonly type: string;
}

/**
 * Reads an owner's instruments directly from the instruments table.
 *
 * This is a narrow, read-only dependency on the instruments schema, not a
 * reimplementation of instrument management (module 5, which owns
 * creation, editing, and identifier validation). It exists so pricing's UI
 * can offer an instrument picker before that module's own application
 * layer lands, consistent with the "instruments -> pricing" dependency
 * direction in design.md.
 */
export async function listOwnedInstrumentSummaries(ownerId: UserId): Promise<OwnedInstrumentSummary[]> {
  const rows = await db
    .select({ id: instruments.id, name: instruments.name, type: instruments.type })
    .from(instruments)
    .where(eq(instruments.ownerId, ownerId))
    .orderBy(instruments.name);

  return rows.map((row) => ({ id: toInstrumentId(row.id), name: row.name, type: row.type }));
}
