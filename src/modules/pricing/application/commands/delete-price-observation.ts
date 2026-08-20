import type { PriceObservationId } from "@/modules/pricing/domain/price-observation";
import type { PriceObservationRepository } from "@/modules/pricing/domain/price-observation-repository";
import type { UserId } from "@/shared/domain/user-id";

/** Deletes an owned manual price observation. Throws `NotFoundError` if not owned. */
export async function deletePriceObservation(
  repository: PriceObservationRepository,
  ownerId: UserId,
  id: PriceObservationId,
): Promise<void> {
  await repository.delete(ownerId, id);
}
