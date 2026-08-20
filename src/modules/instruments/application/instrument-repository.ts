import type { UserId } from "@/shared/domain/user-id";
import type { Instrument, InstrumentId, NormalizedInstrumentInput } from "../domain/instrument";

/** Owner-scoped persistence port for instruments (see design.md decision 4). */
export interface InstrumentRepository {
  listOwned(ownerId: UserId): Promise<Instrument[]>;
  findOwnedById(ownerId: UserId, id: InstrumentId): Promise<Instrument | null>;
  /** Used to point a duplicate-ISIN rejection at the existing instrument. */
  findOwnedByIsin(ownerId: UserId, isin: string): Promise<Instrument | null>;
  /** Throws `ConflictError` if the owner already has an instrument with this ISIN. */
  create(ownerId: UserId, input: NormalizedInstrumentInput): Promise<Instrument>;
  /** Returns `null` if `id` is not owned by `ownerId`. Throws `ConflictError` on a duplicate ISIN. */
  update(ownerId: UserId, id: InstrumentId, input: NormalizedInstrumentInput): Promise<Instrument | null>;
  /**
   * Returns `true` if a row owned by `ownerId` was deleted. Throws
   * `ConflictError` when the instrument is referenced by ledger entries
   * or price observations.
   */
  delete(ownerId: UserId, id: InstrumentId): Promise<boolean>;
}
