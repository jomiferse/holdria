import { ConflictError } from "@/shared/domain/errors";

/**
 * A manual price observation already exists for this instrument and
 * effective date. Per the pricing spec, the owner must edit the existing
 * observation rather than create an ambiguous duplicate.
 */
export class DuplicatePriceObservationError extends ConflictError {
  constructor(effectiveDate: string) {
    super(`A price observation already exists for ${effectiveDate}. Edit the existing observation instead.`);
  }
}
