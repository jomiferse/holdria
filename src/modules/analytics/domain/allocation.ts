import type { Decimal } from "@/shared/domain/decimal";
import { ZERO } from "@/shared/domain/decimal";
import { Money } from "@/shared/domain/money";

import type { InstrumentId } from "@/modules/transactions/domain/ledger-reducer";

import type { PortfolioValuation } from "./valuation";

/** Minimal instrument metadata allocation needs to label each position. */
export interface AllocationInstrumentMeta {
  readonly name: string;
  readonly type: string;
}

export interface AllocationByInstrument {
  readonly instrumentId: InstrumentId;
  readonly instrumentName: string;
  readonly instrumentType: string;
  readonly marketValue: Money;
  /** Fraction of total invested market value (0..1). */
  readonly weight: Decimal;
}

export interface AllocationByType {
  readonly instrumentType: string;
  readonly marketValue: Money;
  readonly weight: Decimal;
}

export type AllocationResult =
  | {
      readonly status: "complete";
      readonly totalMarketValue: Money;
      readonly byInstrument: readonly AllocationByInstrument[];
      readonly byType: readonly AllocationByType[];
    }
  | {
      readonly status: "incomplete";
      readonly unpricedInstrumentIds: readonly InstrumentId[];
    };

/**
 * Derives allocation by instrument and instrument type from a portfolio
 * valuation (analytics spec: "Portfolio allocation"). Weights are computed
 * over invested market value only (cash is excluded, matching "proportion
 * of invested market value").
 *
 * Mirrors the valuation's own completeness: if any held position lacks a
 * price the whole allocation is `incomplete` and identifies the missing
 * instruments, rather than silently allocating over a partial total.
 */
export function calculateAllocation(
  valuation: PortfolioValuation,
  instruments: ReadonlyMap<InstrumentId, AllocationInstrumentMeta>,
): AllocationResult {
  if (valuation.status === "incomplete") {
    return { status: "incomplete", unpricedInstrumentIds: valuation.unpricedInstrumentIds };
  }

  const totalMarketValue = valuation.positions.reduce(
    (sum, position) => sum.plus(position.marketValue as Money),
    Money.zero(),
  );
  const totalDecimal = totalMarketValue.amount;

  function weightOf(marketValue: Money): Decimal {
    return totalDecimal.isZero() ? ZERO : marketValue.amount.dividedBy(totalDecimal);
  }

  const byInstrument: AllocationByInstrument[] = valuation.positions.map((position) => {
    const meta = instruments.get(position.instrumentId);
    const marketValue = position.marketValue as Money;
    return {
      instrumentId: position.instrumentId,
      instrumentName: meta?.name ?? "Unknown instrument",
      instrumentType: meta?.type ?? "UNKNOWN",
      marketValue,
      weight: weightOf(marketValue),
    };
  });

  const byTypeMap = new Map<string, Money>();
  for (const entry of byInstrument) {
    const existing = byTypeMap.get(entry.instrumentType);
    byTypeMap.set(entry.instrumentType, existing ? existing.plus(entry.marketValue) : entry.marketValue);
  }

  const byType: AllocationByType[] = [...byTypeMap.entries()].map(([instrumentType, marketValue]) => ({
    instrumentType,
    marketValue,
    weight: weightOf(marketValue),
  }));

  return { status: "complete", totalMarketValue, byInstrument, byType };
}
