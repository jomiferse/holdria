import type { Decimal } from "decimal.js";

import type { InstrumentId, PriceObservation, PriceSource } from "@/modules/pricing/domain/price-observation";

/**
 * Result of deterministic as-of price selection.
 *
 * `unpriced` is a first-class outcome, not an error or a zero value: per
 * the pricing spec, "no eligible price exists" must be reported so callers
 * never silently treat a missing price as zero.
 */
export type AsOfPriceResult =
  | {
      readonly status: "priced";
      readonly instrumentId: InstrumentId;
      readonly price: Decimal;
      /** The observation's actual effective date, which may be earlier than the requested `asOfDate`. */
      readonly effectiveDate: string;
      readonly source: PriceSource;
    }
  | {
      readonly status: "unpriced";
      readonly instrumentId: InstrumentId;
      readonly asOfDate: string;
    };

/**
 * Selects the latest eligible observation on or before `asOfDate` from an
 * already-loaded candidate list.
 *
 * Pure and deterministic so it can be unit tested without a database.
 * `YYYY-MM-DD` effective dates compare correctly with plain string
 * comparison, so no date parsing is needed here. The infrastructure
 * repository performs the equivalent selection directly in SQL for
 * efficiency; this function is the source of truth for the selection rule
 * both must agree with.
 */
export function selectAsOfPrice(
  instrumentId: InstrumentId,
  asOfDate: string,
  candidates: readonly PriceObservation[],
): AsOfPriceResult {
  let selected: PriceObservation | undefined;

  for (const candidate of candidates) {
    if (candidate.effectiveDate > asOfDate) continue;
    if (!selected || candidate.effectiveDate > selected.effectiveDate) {
      selected = candidate;
    }
  }

  if (!selected) {
    return { status: "unpriced", instrumentId, asOfDate };
  }

  return {
    status: "priced",
    instrumentId,
    price: selected.price,
    effectiveDate: selected.effectiveDate,
    source: selected.source,
  };
}
