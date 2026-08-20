import type {
  InstrumentId,
  NewPriceObservationInput,
  PriceObservation,
  PriceObservationEditInput,
  PriceObservationId,
} from "@/modules/pricing/domain/price-observation";
import type { UserId } from "@/shared/domain/user-id";

/**
 * Owner-scoped persistence for manual price observations.
 *
 * Every method takes the acting owner explicitly and only returns or
 * mutates rows that belong to them (design.md decision 4:
 * `findOwnedById(actorId, id)`, never unrestricted lookup). Implementations
 * must reject a request whose `instrumentId` belongs to another owner
 * rather than silently narrowing it.
 */
export interface PriceObservationRepository {
  /** Creates a new observation. Throws `DuplicatePriceObservationError` if one already exists for the same instrument and date, `NotFoundError` if the instrument is not owned by `input.ownerId`. */
  create(input: NewPriceObservationInput): Promise<PriceObservation>;

  /** Corrects an existing observation's value and/or effective date. Throws `NotFoundError` if not owned, `DuplicatePriceObservationError` on a resulting date collision. */
  update(ownerId: UserId, id: PriceObservationId, edit: PriceObservationEditInput): Promise<PriceObservation>;

  /** Deletes an observation. Throws `NotFoundError` if not owned. */
  delete(ownerId: UserId, id: PriceObservationId): Promise<void>;

  /** Returns the observation if owned by `ownerId`, otherwise `null`. */
  findOwnedById(ownerId: UserId, id: PriceObservationId): Promise<PriceObservation | null>;

  /** Lists an owned instrument's observations, most recent effective date first. */
  listByInstrument(ownerId: UserId, instrumentId: InstrumentId): Promise<PriceObservation[]>;

  /** Returns the latest owned observation on or before `asOfDate`, or `null` when none is eligible (see `selectAsOfPrice`). */
  findLatestAsOf(ownerId: UserId, instrumentId: InstrumentId, asOfDate: string): Promise<PriceObservation | null>;
}
