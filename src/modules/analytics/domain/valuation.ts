import type { AsOfPriceResult } from "@/modules/pricing/domain/as-of-price";
import { toInstrumentId as toPricingInstrumentId } from "@/modules/pricing/domain/price-observation";
import { Money } from "@/shared/domain/money";
import { Quantity } from "@/shared/domain/quantity";

import type { InstrumentId, LedgerProjection, PositionState } from "@/modules/transactions/domain/ledger-reducer";

/** One priced (or explicitly unpriced) open position, valued as of a single date. */
export interface PositionValuation {
  readonly instrumentId: InstrumentId;
  readonly units: Quantity;
  readonly openCost: Money;
  readonly price: AsOfPriceResult;
  /** `null` when `price.status === "unpriced"` — never a fabricated zero (analytics spec: "An open position lacks a price"). */
  readonly marketValue: Money | null;
  /** `marketValue - openCost`, `null` under the same condition as `marketValue`. */
  readonly unrealizedResult: Money | null;
}

export type PortfolioValuationStatus = "complete" | "incomplete";

/** Cash plus every open position's value, as of one date. */
export interface PortfolioValuation {
  readonly valuationDate: string;
  readonly cash: Money;
  readonly positions: readonly PositionValuation[];
  readonly status: PortfolioValuationStatus;
  /** Instruments held (non-zero units) that had no eligible price on `valuationDate`. */
  readonly unpricedInstrumentIds: readonly InstrumentId[];
  /** `cash + sum(marketValue)`. `null` when `status === "incomplete"` — an incomplete total is never presented as complete (analytics spec: "Current portfolio valuation"). */
  readonly totalValue: Money | null;
}

/** Values one open position against its selected as-of price. Pure; performs no I/O or price lookup itself. */
export function valuePosition(position: PositionState, price: AsOfPriceResult): PositionValuation {
  if (price.status === "unpriced") {
    return {
      instrumentId: position.instrumentId,
      units: position.units,
      openCost: position.openCost,
      price,
      marketValue: null,
      unrealizedResult: null,
    };
  }

  const marketValue = Money.fromDecimal(price.price).times(position.units.value);
  const unrealizedResult = marketValue.minus(position.openCost);

  return {
    instrumentId: position.instrumentId,
    units: position.units,
    openCost: position.openCost,
    price,
    marketValue,
    unrealizedResult,
  };
}

/**
 * Combines a ledger projection with pre-selected as-of prices into one
 * portfolio valuation (analytics spec: "Current portfolio valuation").
 *
 * Pure and deterministic: `prices` must already carry one resolved
 * `AsOfPriceResult` per held instrument (design.md decision 7 — the
 * application layer resolves prices via the pricing module before calling
 * this function). Closed positions (zero units) are excluded; they need
 * no price and contribute no value.
 */
export function valuePortfolio(
  projection: LedgerProjection,
  valuationDate: string,
  prices: ReadonlyMap<InstrumentId, AsOfPriceResult>,
): PortfolioValuation {
  const openPositions = [...projection.positions.values()].filter((position) => !position.units.isZero());

  const positions = openPositions.map((position) => {
    const price =
      prices.get(position.instrumentId) ??
      ({
        status: "unpriced",
        instrumentId: toPricingInstrumentId(position.instrumentId),
        asOfDate: valuationDate,
      } as AsOfPriceResult);
    return valuePosition(position, price);
  });

  const unpricedInstrumentIds = positions
    .filter((position) => position.marketValue === null)
    .map((position) => position.instrumentId);

  const status: PortfolioValuationStatus = unpricedInstrumentIds.length === 0 ? "complete" : "incomplete";

  const totalValue =
    status === "complete"
      ? positions.reduce((sum, position) => sum.plus(position.marketValue as Money), projection.cash)
      : null;

  return {
    valuationDate,
    cash: projection.cash,
    positions,
    status,
    unpricedInstrumentIds,
    totalValue,
  };
}
