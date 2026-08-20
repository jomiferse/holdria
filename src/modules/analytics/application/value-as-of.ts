import { getAsOfPrice } from "@/modules/pricing/application/queries/get-as-of-price";
import type { AsOfPriceResult } from "@/modules/pricing/domain/as-of-price";
import { toInstrumentId as toPricingInstrumentId } from "@/modules/pricing/domain/price-observation";
import type { LedgerEntry } from "@/modules/transactions/domain/ledger-entry";
import { reduceLedger, type InstrumentId } from "@/modules/transactions/domain/ledger-reducer";
import type { UserId } from "@/shared/domain/user-id";

import { valuePortfolio, type PortfolioValuation } from "../domain/valuation";
import type { PortfolioAnalyticsDeps } from "./deps";

/**
 * Replays `entries` up to `asOfDate` (inclusive or exclusive of that date's
 * own entries), resolves an as-of price for every instrument still held at
 * that point, and produces one `PortfolioValuation`.
 *
 * This is the one place ledger replay and price resolution meet I/O:
 * everything it delegates to (`reduceLedger`, `valuePortfolio`) is pure.
 * Used both for "the current valuation" (`inclusive: true`, `asOfDate`
 * today) and for historical/period boundary valuations (analytics spec:
 * "Historical evolution", design.md decision 8's Modified Dietz beginning
 * value).
 */
export async function valuePortfolioAsOf(
  deps: PortfolioAnalyticsDeps,
  ownerId: UserId,
  entries: readonly LedgerEntry[],
  asOfDate: string,
  options: { readonly inclusive: boolean } = { inclusive: true },
): Promise<PortfolioValuation> {
  const filtered = entries.filter((entry) => {
    const date = entry.effectiveDate.toString();
    return options.inclusive ? date <= asOfDate : date < asOfDate;
  });

  const projection = reduceLedger(filtered);
  const openInstrumentIds = [...projection.positions.values()]
    .filter((position) => !position.units.isZero())
    .map((position) => position.instrumentId);

  const prices = new Map<InstrumentId, AsOfPriceResult>();
  for (const instrumentId of openInstrumentIds) {
    const price = await getAsOfPrice(
      deps.priceObservationRepository,
      ownerId,
      toPricingInstrumentId(instrumentId),
      asOfDate,
    );
    prices.set(instrumentId, price);
  }

  return valuePortfolio(projection, asOfDate, prices);
}
