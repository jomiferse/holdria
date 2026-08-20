import {
  parseEffectiveDate,
  parsePriceValue,
  type PriceObservation,
  type PriceObservationEditInput,
  type PriceObservationId,
} from "@/modules/pricing/domain/price-observation";
import type { PriceObservationRepository } from "@/modules/pricing/domain/price-observation-repository";
import type { UserId } from "@/shared/domain/user-id";

/**
 * Corrects an existing manual price observation's value and/or effective
 * date. Subsequent as-of selection and valuations pick up the correction
 * automatically because they always read the current stored observation.
 */
export async function editPriceObservation(
  repository: PriceObservationRepository,
  ownerId: UserId,
  id: PriceObservationId,
  edit: PriceObservationEditInput,
): Promise<PriceObservation> {
  parsePriceValue(edit.price);
  parseEffectiveDate(edit.effectiveDate);

  return repository.update(ownerId, id, edit);
}
