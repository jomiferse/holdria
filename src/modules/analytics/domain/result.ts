import { Money } from "@/shared/domain/money";

import type { LedgerEntry } from "@/modules/transactions/domain/ledger-entry";
import type { LedgerProjection } from "@/modules/transactions/domain/ledger-reducer";

import type { PortfolioValuation } from "./valuation";

/** Cumulative external cash flows read directly from the ledger, independent of pricing. */
export interface CumulativeFlows {
  readonly contributions: Money;
  readonly withdrawals: Money;
}

/** Sums every CONTRIBUTION and WITHDRAWAL entry's cash amount. Pure; entry order does not matter for a sum. */
export function calculateCumulativeFlows(entries: readonly LedgerEntry[]): CumulativeFlows {
  let contributions = Money.zero();
  let withdrawals = Money.zero();

  for (const entry of entries) {
    if (entry.type === "CONTRIBUTION") {
      contributions = contributions.plus(entry.cashAmount);
    } else if (entry.type === "WITHDRAWAL") {
      withdrawals = withdrawals.plus(entry.cashAmount);
    }
  }

  return { contributions, withdrawals };
}

/** Open cost, realized/unrealized result, and absolute result for one portfolio (analytics spec: "Absolute portfolio result"). */
export interface PortfolioResult {
  readonly status: "complete" | "incomplete";
  /** Always available: realized result never depends on a current price. */
  readonly realizedResult: Money;
  /** Sum of every open position's cost basis, always available. */
  readonly totalOpenCost: Money;
  /** `null` when the valuation is incomplete (an unpriced position has no unrealized result). */
  readonly unrealizedResult: Money | null;
  readonly cumulativeFlows: CumulativeFlows;
  /** `currentValue + withdrawals - contributions`. `null` when the valuation is incomplete. */
  readonly absoluteResult: Money | null;
}

/**
 * Derives open cost, realized/unrealized result, and total absolute result
 * from a ledger projection, its source entries, and a current valuation.
 *
 * Realized result and open cost come straight from the ledger projection
 * (never price-dependent, per "Portfolio contains a partial sale").
 * Unrealized and absolute result require a complete valuation and are
 * explicitly `null` — never a silent zero — otherwise (analytics spec:
 * "Absolute portfolio result").
 */
export function calculatePortfolioResult(
  entries: readonly LedgerEntry[],
  projection: LedgerProjection,
  valuation: PortfolioValuation,
): PortfolioResult {
  const totalOpenCost = [...projection.positions.values()].reduce(
    (sum, position) => sum.plus(position.openCost),
    Money.zero(),
  );

  const cumulativeFlows = calculateCumulativeFlows(entries);

  const unrealizedResult =
    valuation.status === "complete"
      ? valuation.positions.reduce((sum, position) => sum.plus(position.unrealizedResult as Money), Money.zero())
      : null;

  const absoluteResult =
    valuation.totalValue !== null
      ? valuation.totalValue.plus(cumulativeFlows.withdrawals).minus(cumulativeFlows.contributions)
      : null;

  return {
    status: valuation.status,
    realizedResult: projection.realizedResult,
    totalOpenCost,
    unrealizedResult,
    cumulativeFlows,
    absoluteResult,
  };
}
