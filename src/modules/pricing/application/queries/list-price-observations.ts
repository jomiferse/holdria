import type { InstrumentId, PriceObservation } from "@/modules/pricing/domain/price-observation";
import type { PriceObservationRepository } from "@/modules/pricing/domain/price-observation-repository";
import type { UserId } from "@/shared/domain/user-id";

/** Lists an owned instrument's manual price observations, most recent effective date first. */
export async function listPriceObservations(
  repository: PriceObservationRepository,
  ownerId: UserId,
  instrumentId: InstrumentId,
): Promise<PriceObservation[]> {
  return repository.listByInstrument(ownerId, instrumentId);
}
