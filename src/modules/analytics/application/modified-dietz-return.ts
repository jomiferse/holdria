import type { PortfolioId } from "@/modules/transactions/domain/ledger-entry";
import type { UserId } from "@/shared/domain/user-id";

import { calculateModifiedDietz, type ExternalCashFlow, type ModifiedDietzResult } from "../domain/modified-dietz";
import { type PortfolioAnalyticsDeps, todayDateOnly } from "./deps";
import { valuePortfolioAsOf } from "./value-as-of";

export interface ModifiedDietzPeriod {
  /** Defaults to the portfolio's first CONTRIBUTION date (since inception). */
  readonly start?: string;
  /** Defaults to today. */
  readonly end?: string;
}

/**
 * Calculates the portfolio's Modified Dietz return for an arbitrary period
 * or since inception (task 8.3, analytics spec: "Modified Dietz return").
 *
 * `beginningValue` uses entries strictly before the period start and
 * `endingValue` uses entries on or before the period end, so a flow dated
 * exactly on the period start is counted once — as a weighted flow, not
 * baked into the beginning balance. This makes "since inception" (period
 * start = first contribution date) naturally produce a zero beginning
 * value without a special case: nothing precedes that date.
 */
export async function calculatePortfolioModifiedDietz(
  deps: PortfolioAnalyticsDeps,
  ownerId: UserId,
  portfolioId: PortfolioId,
  period: ModifiedDietzPeriod = {},
): Promise<ModifiedDietzResult> {
  const entries = await deps.listLedgerEntries(ownerId, portfolioId);
  const periodEnd = period.end ?? todayDateOnly();

  let periodStart = period.start;
  if (!periodStart) {
    const contributions = entries
      .filter((entry) => entry.type === "CONTRIBUTION")
      .sort((a, b) => a.effectiveDate.compareTo(b.effectiveDate));
    const first = contributions[0];
    if (!first) {
      return {
        status: "unavailable",
        periodStart: periodEnd,
        periodEnd,
        reason: "Return is unavailable because the portfolio has no contributions yet.",
      };
    }
    periodStart = first.effectiveDate.toString();
  }

  if (periodStart > periodEnd) {
    return {
      status: "unavailable",
      periodStart,
      periodEnd,
      reason: "The period start must be on or before its end.",
    };
  }

  const [beginningValuation, endingValuation] = await Promise.all([
    valuePortfolioAsOf(deps, ownerId, entries, periodStart, { inclusive: false }),
    valuePortfolioAsOf(deps, ownerId, entries, periodEnd, { inclusive: true }),
  ]);

  const flows: ExternalCashFlow[] = entries
    .filter((entry) => entry.type === "CONTRIBUTION" || entry.type === "WITHDRAWAL")
    .filter((entry) => {
      const date = entry.effectiveDate.toString();
      return date >= (periodStart as string) && date <= periodEnd;
    })
    .map((entry) => ({
      date: entry.effectiveDate.toString(),
      amount: entry.type === "CONTRIBUTION" ? entry.cashAmount : entry.cashAmount.times(-1),
    }));

  const beginningValue = beginningValuation.status === "complete" ? beginningValuation.totalValue : null;
  const endingValue = endingValuation.status === "complete" ? endingValuation.totalValue : null;

  return calculateModifiedDietz(periodStart, periodEnd, beginningValue, endingValue, flows);
}
