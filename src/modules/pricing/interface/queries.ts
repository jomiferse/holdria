import { listPriceObservations } from "@/modules/pricing/application/queries/list-price-observations";
import type { PriceObservation } from "@/modules/pricing/domain/price-observation";
import { listOwnedInstrumentSummaries, type OwnedInstrumentSummary } from "@/modules/pricing/infrastructure/instrument-lookup";
import { priceObservationRepository } from "@/modules/pricing/infrastructure/price-observation-repository";
import type { UserId } from "@/shared/domain/user-id";

/** One owned instrument together with every manual price observation recorded for it, for the prices list page. */
export interface InstrumentWithPriceObservations {
  readonly instrument: OwnedInstrumentSummary;
  readonly observations: PriceObservation[];
}

/** Server Component read model for the manual-prices page: every owned instrument and its recorded observations. */
export async function getInstrumentsWithPriceObservations(ownerId: UserId): Promise<InstrumentWithPriceObservations[]> {
  const instruments = await listOwnedInstrumentSummaries(ownerId);

  return Promise.all(
    instruments.map(async (instrument) => ({
      instrument,
      observations: await listPriceObservations(priceObservationRepository, ownerId, instrument.id),
    })),
  );
}
