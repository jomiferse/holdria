import type { InstrumentId } from "@/modules/pricing/domain/price-observation";
import type { UserId } from "@/shared/domain/user-id";

/**
 * A link between an owned instrument and a specific pricing/search
 * provider's identifier for that instrument.
 *
 * No provider is implemented in this change. This type and its repository
 * only reserve the persistence shape so a real provider adapter can later
 * resolve "which instrument is this provider result for" without a schema
 * or domain change.
 */
export interface InstrumentExternalReference {
  readonly id: string;
  readonly ownerId: UserId;
  readonly instrumentId: InstrumentId;
  readonly provider: string;
  readonly externalId: string;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface InstrumentExternalReferenceRepository {
  /** Creates or replaces the owned instrument's reference for `provider`. */
  upsert(
    ownerId: UserId,
    instrumentId: InstrumentId,
    provider: string,
    externalId: string,
  ): Promise<InstrumentExternalReference>;

  /** Lists an owned instrument's provider references. */
  listByInstrument(ownerId: UserId, instrumentId: InstrumentId): Promise<InstrumentExternalReference[]>;

  /** Deletes an owned reference. Throws `NotFoundError` if not owned. */
  delete(ownerId: UserId, id: string): Promise<void>;
}
