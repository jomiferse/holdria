import { describe, expect, it } from "vitest";

import { toInstrumentId } from "@/modules/pricing/domain/price-observation";
import { Money } from "@/shared/domain/money";
import { Quantity } from "@/shared/domain/quantity";

import type { InstrumentId, LedgerProjection, PositionState } from "@/modules/transactions/domain/ledger-reducer";

import { valuePortfolio, valuePosition } from "./valuation";

const instrumentA = "20000000-0000-0000-0000-000000000001" as InstrumentId;
const instrumentB = "20000000-0000-0000-0000-000000000002" as InstrumentId;

function position(overrides: Partial<PositionState> = {}): PositionState {
  return {
    instrumentId: instrumentA,
    units: Quantity.fromDecimal("10"),
    openCost: Money.fromDecimal("1000"),
    realizedResult: Money.zero(),
    ...overrides,
  };
}

describe("valuePosition", () => {
  it("golden case: priced position computes market value and unrealized result", () => {
    const result = valuePosition(position(), {
      status: "priced",
      instrumentId: toInstrumentId(instrumentA),
      price: Money.fromDecimal("120").amount,
      effectiveDate: "2026-01-15",
      source: "MANUAL",
    });

    expect(result.marketValue?.toPersistedString()).toBe("1200");
    expect(result.unrealizedResult?.toPersistedString()).toBe("200");
  });

  it("an unpriced position never fabricates a market value or result", () => {
    const result = valuePosition(position(), {
      status: "unpriced",
      instrumentId: toInstrumentId(instrumentA),
      asOfDate: "2026-01-15",
    });

    expect(result.marketValue).toBeNull();
    expect(result.unrealizedResult).toBeNull();
  });
});

describe("valuePortfolio", () => {
  function projection(positions: PositionState[], cash = "50"): LedgerProjection {
    return {
      cash: Money.fromDecimal(cash),
      positions: new Map(positions.map((p) => [p.instrumentId, p])),
      realizedResult: Money.zero(),
    };
  }

  it("golden case: every open position priced yields a complete total value", () => {
    const proj = projection([position()]);
    const prices = new Map([
      [
        instrumentA,
        {
          status: "priced" as const,
          instrumentId: toInstrumentId(instrumentA),
          price: Money.fromDecimal("120").amount,
          effectiveDate: "2026-01-15",
          source: "MANUAL" as const,
        },
      ],
    ]);

    const valuation = valuePortfolio(proj, "2026-01-15", prices);

    expect(valuation.status).toBe("complete");
    // cash 50 + market value 1200
    expect(valuation.totalValue?.toPersistedString()).toBe("1250");
    expect(valuation.unpricedInstrumentIds).toEqual([]);
  });

  it("one unpriced open position marks the whole valuation incomplete", () => {
    const proj = projection([position(), position({ instrumentId: instrumentB, units: Quantity.fromDecimal("5") })]);
    const prices = new Map([
      [
        instrumentA,
        {
          status: "priced" as const,
          instrumentId: toInstrumentId(instrumentA),
          price: Money.fromDecimal("120").amount,
          effectiveDate: "2026-01-15",
          source: "MANUAL" as const,
        },
      ],
    ]);

    const valuation = valuePortfolio(proj, "2026-01-15", prices);

    expect(valuation.status).toBe("incomplete");
    expect(valuation.totalValue).toBeNull();
    expect(valuation.unpricedInstrumentIds).toEqual([instrumentB]);
  });

  it("excludes closed positions (zero units) from valuation and pricing", () => {
    const proj = projection([position({ units: Quantity.zero(), openCost: Money.zero() })]);

    const valuation = valuePortfolio(proj, "2026-01-15", new Map());

    expect(valuation.status).toBe("complete");
    expect(valuation.positions).toEqual([]);
    expect(valuation.totalValue?.toPersistedString()).toBe("50");
  });

  it("repeated calculation with identical inputs is reproducible", () => {
    const proj = projection([position()]);
    const prices = new Map([
      [
        instrumentA,
        {
          status: "priced" as const,
          instrumentId: toInstrumentId(instrumentA),
          price: Money.fromDecimal("120").amount,
          effectiveDate: "2026-01-15",
          source: "MANUAL" as const,
        },
      ],
    ]);

    const first = valuePortfolio(proj, "2026-01-15", prices);
    const second = valuePortfolio(proj, "2026-01-15", prices);

    expect(first.totalValue?.toPersistedString()).toBe(second.totalValue?.toPersistedString());
  });
});
