import {
  parseEffectiveDate,
  parsePriceCurrency,
  parsePriceValue,
  type NewPriceObservationInput,
  type PriceObservation,
} from "@/modules/pricing/domain/price-observation";
import type { PriceObservationRepository } from "@/modules/pricing/domain/price-observation-repository";

/**
 * Records a new manual price observation for an owned instrument.
 *
 * Validates the value, currency, and effective date before touching
 * persistence. `PriceObservationRepository.create` is responsible for
 * rejecting an instrument the caller does not own (`NotFoundError`) and an
 * existing observation on the same date (`DuplicatePriceObservationError`).
 */
export async function recordPriceObservation(
  repository: PriceObservationRepository,
  input: NewPriceObservationInput,
): Promise<PriceObservation> {
  parsePriceValue(input.price);
  parsePriceCurrency(input.currency);
  parseEffectiveDate(input.effectiveDate);

  return repository.create(input);
}
