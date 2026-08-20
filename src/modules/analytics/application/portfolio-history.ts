import { toInstrumentId as toPricingInstrumentId } from "@/modules/pricing/domain/price-observation";
import type { PortfolioId } from "@/modules/transactions/domain/ledger-entry";
import type { UserId } from "@/shared/domain/user-id";

import type { PortfolioValuation } from "../domain/valuation";
import { todayDateOnly, type PortfolioAnalyticsDeps } from "./deps";
import { valuePortfolioAsOf } from "./value-as-of";

/** One reconstructed point in a portfolio's history: its valuation as of `date`, complete or explicitly incomplete. */
export interface PortfolioSnapshot {
  readonly date: string;
  readonly valuation: PortfolioValuation;
}

/**
 * Reconstructs `PortfolioSnapshot`s on demand from ledger entries and price
 * observations (task 8.5, analytics spec: "Historical evolution").
 *
 * No snapshot is ever persisted (design.md decision 5: `PortfolioSnapshot`
 * is a domain/read-model value, not a table) — every call replays the
 * ledger and re-selects prices from current source data, so an edited or
 * deleted entry or price is reflected the next time history is requested
 * ("Source data is corrected").
 *
 * Snapshot dates default to every distinct effective date the portfolio's
 * ledger entries carry, every effective date of a manual price observation
 * recorded for an instrument the portfolio ever traded, and today. Prices
 * are one of the two authoritative sources for a historical point (analytics
 * spec: "reconstructible historical portfolio values from ledger entries
 * and dated prices"), so a price-only change (no new ledger activity) must
 * still produce a new point — otherwise the evolution chart would be blind
 * to market-value changes between ledger events. This still needs no
 * arbitrary calendar-bucketing policy the specs do not define; callers that
 * need a specific set of dates (e.g. month-end points) may pass `dates`
 * explicitly.
 */
export async function reconstructPortfolioHistory(
  deps: PortfolioAnalyticsDeps,
  ownerId: UserId,
  portfolioId: PortfolioId,
  dates?: readonly string[],
): Promise<PortfolioSnapshot[]> {
  // See `getPortfolioAnalytics` — independently verifies ownership first.
  await deps.requireOwnedPortfolio(ownerId, portfolioId);

  const entries = await deps.listLedgerEntries(ownerId, portfolioId);

  const snapshotDates = dates ?? (await defaultSnapshotDates(deps, ownerId, entries));

  const snapshots: PortfolioSnapshot[] = [];
  for (const date of snapshotDates) {
    const valuation = await valuePortfolioAsOf(deps, ownerId, entries, date, { inclusive: true });
    snapshots.push({ date, valuation });
  }

  return snapshots;
}

async function defaultSnapshotDates(
  deps: PortfolioAnalyticsDeps,
  ownerId: UserId,
  entries: Awaited<ReturnType<PortfolioAnalyticsDeps["listLedgerEntries"]>>,
): Promise<string[]> {
  const distinct = new Set(entries.map((entry) => entry.effectiveDate.toString()));

  const tradedInstrumentIds = new Set(
    entries.filter((entry) => entry.type === "BUY" || entry.type === "SELL").map((entry) => entry.instrumentId),
  );

  const priceDatesByInstrument = await Promise.all(
    [...tradedInstrumentIds].map((instrumentId) =>
      deps.priceObservationRepository.listByInstrument(ownerId, toPricingInstrumentId(instrumentId)),
    ),
  );
  for (const observations of priceDatesByInstrument) {
    for (const observation of observations) {
      distinct.add(observation.effectiveDate);
    }
  }

  distinct.add(todayDateOnly());
  return [...distinct].sort();
}
