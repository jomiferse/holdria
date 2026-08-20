import { describe, expect, it } from "vitest";

import { toInstrumentId as toPricingInstrumentId } from "@/modules/pricing/domain/price-observation";
import { Money } from "@/shared/domain/money";
import { Quantity } from "@/shared/domain/quantity";

import type { InstrumentId } from "@/modules/transactions/domain/ledger-reducer";

import { calculateAllocation, type AllocationInstrumentMeta } from "./allocation";
import type { PortfolioValuation, PositionValuation } from "./valuation";

const instrumentA = "20000000-0000-0000-0000-000000000001" as InstrumentId;
const instrumentB = "20000000-0000-0000-0000-000000000002" as InstrumentId;

function pricedPosition(instrumentId: InstrumentId, marketValue: string): PositionValuation {
  return {
    instrumentId,
    units: Quantity.fromDecimal("1"),
    openCost: Money.fromDecimal("0"),
    price: {
      status: "priced",
      instrumentId: toPricingInstrumentId(instrumentId),
      price: Money.fromDecimal(marketValue).amount,
      effectiveDate: "2026-01-01",
      source: "MANUAL",
    },
    marketValue: Money.fromDecimal(marketValue),
    unrealizedResult: Money.fromDecimal("0"),
  };
}

function completeValuation(positions: PositionValuation[]): PortfolioValuation {
  const totalValue = positions.reduce((sum, p) => sum.plus(p.marketValue as Money), Money.zero());
  return {
    valuationDate: "2026-01-01",
    cash: Money.zero(),
    positions,
    status: "complete",
    unpricedInstrumentIds: [],
    totalValue,
  };
}

const meta: ReadonlyMap<InstrumentId, AllocationInstrumentMeta> = new Map([
  [instrumentA, { name: "Fund A", type: "FUND" }],
  [instrumentB, { name: "ETF B", type: "ETF" }],
]);

describe("calculateAllocation", () => {
  it("golden case: two positions split weight proportionally to market value", () => {
    const valuation = completeValuation([pricedPosition(instrumentA, "300"), pricedPosition(instrumentB, "700")]);

    const allocation = calculateAllocation(valuation, meta);

    expect(allocation.status).toBe("complete");
    if (allocation.status !== "complete") throw new Error("unreachable");
    expect(allocation.totalMarketValue.toPersistedString()).toBe("1000");
    const a = allocation.byInstrument.find((e) => e.instrumentId === instrumentA);
    const b = allocation.byInstrument.find((e) => e.instrumentId === instrumentB);
    expect(a?.weight.toNumber()).toBeCloseTo(0.3, 10);
    expect(b?.weight.toNumber()).toBeCloseTo(0.7, 10);
  });

  it("groups by instrument type across multiple instruments of the same type", () => {
    const instrumentA2 = "20000000-0000-0000-0000-000000000003" as InstrumentId;
    const metaWithTwoFunds = new Map(meta).set(instrumentA2, { name: "Fund A2", type: "FUND" });
    const valuation = completeValuation([
      pricedPosition(instrumentA, "300"),
      pricedPosition(instrumentA2, "300"),
      pricedPosition(instrumentB, "400"),
    ]);

    const allocation = calculateAllocation(valuation, metaWithTwoFunds);

    expect(allocation.status).toBe("complete");
    if (allocation.status !== "complete") throw new Error("unreachable");
    const fundType = allocation.byType.find((e) => e.instrumentType === "FUND");
    expect(fundType?.marketValue.toPersistedString()).toBe("600");
    expect(fundType?.weight.toNumber()).toBeCloseTo(0.6, 10);
  });

  it("an incomplete valuation produces an incomplete allocation naming the unpriced instruments", () => {
    const valuation: PortfolioValuation = {
      valuationDate: "2026-01-01",
      cash: Money.zero(),
      positions: [],
      status: "incomplete",
      unpricedInstrumentIds: [instrumentB],
      totalValue: null,
    };

    const allocation = calculateAllocation(valuation, meta);

    expect(allocation.status).toBe("incomplete");
    if (allocation.status !== "incomplete") throw new Error("unreachable");
    expect(allocation.unpricedInstrumentIds).toEqual([instrumentB]);
  });
});
