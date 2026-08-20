import type { AsOfPriceResult } from "@/modules/pricing/domain/as-of-price";
import type { InstrumentId } from "@/modules/pricing/domain/price-observation";
import type { PriceObservationRepository } from "@/modules/pricing/domain/price-observation-repository";
import type { UserId } from "@/shared/domain/user-id";

/**
 * Deterministic as-of price selection for one owned instrument (pricing
 * spec: "Deterministic as-of price selection"). Delegates the actual
 * search to the repository's SQL-level equivalent of
 * `selectAsOfPrice` for efficiency, but always returns the same
 * `priced` / `unpriced` shape that pure logic produces so callers never
 * need to distinguish "no row" from "not yet priced".
 */
export async function getAsOfPrice(
  repository: PriceObservationRepository,
  ownerId: UserId,
  instrumentId: InstrumentId,
  asOfDate: string,
): Promise<AsOfPriceResult> {
  const observation = await repository.findLatestAsOf(ownerId, instrumentId, asOfDate);

  if (!observation) {
    return { status: "unpriced", instrumentId, asOfDate };
  }

  return {
    status: "priced",
    instrumentId,
    price: observation.price,
    effectiveDate: observation.effectiveDate,
    source: observation.source,
  };
}
