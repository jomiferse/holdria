import type { Instrument } from "@/modules/instruments/domain/instrument";
import type { PortfolioId } from "@/modules/transactions/domain/ledger-entry";
import { reduceLedger, type InstrumentId, type LedgerProjection } from "@/modules/transactions/domain/ledger-reducer";
import type { UserId } from "@/shared/domain/user-id";

import { calculateAllocation, type AllocationResult } from "../domain/allocation";
import { calculatePortfolioResult, type PortfolioResult } from "../domain/result";
import type { PortfolioValuation } from "../domain/valuation";
import { type PortfolioAnalyticsDeps, todayDateOnly } from "./deps";
import { valuePortfolioAsOf } from "./value-as-of";

/** Current-state analytics for one portfolio: valuation, result, and allocation, all as of the same date. */
export interface PortfolioAnalytics {
  readonly asOfDate: string;
  readonly projection: LedgerProjection;
  readonly valuation: PortfolioValuation;
  readonly result: PortfolioResult;
  readonly allocation: AllocationResult;
  readonly instrumentsById: ReadonlyMap<InstrumentId, Instrument>;
}

/**
 * Combines the ledger projection with owner-scoped as-of prices to produce
 * current position valuation, absolute result, and allocation (tasks 8.1,
 * 8.2, 8.4). Does not decide whether any ledger mutation is valid — that
 * remains the transactions module's responsibility (design.md decision 1).
 */
export async function getPortfolioAnalytics(
  deps: PortfolioAnalyticsDeps,
  ownerId: UserId,
  portfolioId: PortfolioId,
  asOfDate: string = todayDateOnly(),
): Promise<PortfolioAnalytics> {
  const [entries, instruments] = await Promise.all([
    deps.listLedgerEntries(ownerId, portfolioId),
    deps.listOwnedInstruments(ownerId),
  ]);

  const instrumentsById: ReadonlyMap<InstrumentId, Instrument> = new Map(
    instruments.map((instrument) => [instrument.id, instrument]),
  );

  const valuation = await valuePortfolioAsOf(deps, ownerId, entries, asOfDate, { inclusive: true });
  const projection = reduceLedger(entries.filter((entry) => entry.effectiveDate.toString() <= asOfDate));
  const result = calculatePortfolioResult(entries, projection, valuation);

  const instrumentMeta = new Map(
    instruments.map((instrument) => [instrument.id as InstrumentId, { name: instrument.name, type: instrument.type }]),
  );
  const allocation = calculateAllocation(valuation, instrumentMeta);

  return { asOfDate, projection, valuation, result, allocation, instrumentsById };
}
