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
 * ledger entries carry, plus today if not already included. Manual pricing
 * produces a small input set (design.md decision 5), so reconstructing one
 * point per ledger-changing event is simple, sufficient for the MVP's
 * scale, and needs no arbitrary calendar-bucketing policy the specs do not
 * define. Callers that need a specific set of dates (e.g. month-end
 * points) may pass `dates` explicitly.
 */
export async function reconstructPortfolioHistory(
  deps: PortfolioAnalyticsDeps,
  ownerId: UserId,
  portfolioId: PortfolioId,
  dates?: readonly string[],
): Promise<PortfolioSnapshot[]> {
  const entries = await deps.listLedgerEntries(ownerId, portfolioId);

  const snapshotDates =
    dates ??
    (() => {
      const distinct = new Set(entries.map((entry) => entry.effectiveDate.toString()));
      distinct.add(todayDateOnly());
      return [...distinct].sort();
    })();

  const snapshots: PortfolioSnapshot[] = [];
  for (const date of snapshotDates) {
    const valuation = await valuePortfolioAsOf(deps, ownerId, entries, date, { inclusive: true });
    snapshots.push({ date, valuation });
  }

  return snapshots;
}
