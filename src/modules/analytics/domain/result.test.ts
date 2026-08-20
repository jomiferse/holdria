import { describe, expect, it } from "vitest";

import { toInstrumentId } from "@/modules/pricing/domain/price-observation";
import { createBuy, createContribution, createWithdrawal } from "@/modules/transactions/domain/ledger-entry";
import type { LedgerEntry } from "@/modules/transactions/domain/ledger-entry";
import { reduceLedger } from "@/modules/transactions/domain/ledger-reducer";
import { Money } from "@/shared/domain/money";
import { toUserId } from "@/shared/domain/user-id";

import { calculateCumulativeFlows, calculatePortfolioResult } from "./result";
import { valuePortfolio } from "./valuation";

const owner = toUserId("00000000-0000-0000-0000-000000000001");
const portfolioId = "10000000-0000-0000-0000-000000000001";
const instrumentA = "20000000-0000-0000-0000-000000000001";

function seq<T extends LedgerEntry>(entry: T, sequence: number): T {
  return { ...entry, sequence: BigInt(sequence) };
}

describe("calculateCumulativeFlows", () => {
  it("sums contributions and withdrawals separately, ignoring buys and sells", () => {
    const entries = [
      seq(createContribution(owner, { portfolioId, effectiveDate: "2026-01-01", cashAmount: "1000" }), 1),
      seq(
        createBuy(owner, {
          portfolioId,
          effectiveDate: "2026-01-02",
          instrumentId: instrumentA,
          quantity: "10",
          unitPrice: "50",
        }),
        2,
      ),
      seq(createWithdrawal(owner, { portfolioId, effectiveDate: "2026-01-03", cashAmount: "100" }), 3),
    ];

    const flows = calculateCumulativeFlows(entries);

    expect(flows.contributions.toPersistedString()).toBe("1000");
    expect(flows.withdrawals.toPersistedString()).toBe("100");
  });
});

describe("calculatePortfolioResult", () => {
  it("golden case: complete valuation yields absolute result = value + withdrawals - contributions", () => {
    const entries = [
      seq(createContribution(owner, { portfolioId, effectiveDate: "2026-01-01", cashAmount: "1000" }), 1),
      seq(
        createBuy(owner, {
          portfolioId,
          effectiveDate: "2026-01-02",
          instrumentId: instrumentA,
          quantity: "10",
          unitPrice: "50",
        }),
        2,
      ),
      seq(createWithdrawal(owner, { portfolioId, effectiveDate: "2026-01-03", cashAmount: "100" }), 3),
    ];

    const projection = reduceLedger(entries);
    const valuation = valuePortfolio(
      projection,
      "2026-01-04",
      new Map([
        [
          instrumentA,
          {
            status: "priced" as const,
            instrumentId: toInstrumentId(instrumentA),
            price: Money.fromDecimal("60").amount,
            effectiveDate: "2026-01-04",
            source: "MANUAL" as const,
          },
        ],
      ]),
    );

    const result = calculatePortfolioResult(entries, projection, valuation);

    // cash after ops: 1000 - 500 - 100 = 400; positions: 10 * 60 = 600; total 1000
    expect(valuation.totalValue?.toPersistedString()).toBe("1000");
    // absolute result = 1000 + withdrawals(100) - contributions(1000) = 100
    expect(result.absoluteResult?.toPersistedString()).toBe("100");
    expect(result.status).toBe("complete");
  });

  it("an incomplete valuation leaves unrealized and absolute result unavailable, not zero", () => {
    const entries = [
      seq(createContribution(owner, { portfolioId, effectiveDate: "2026-01-01", cashAmount: "1000" }), 1),
      seq(
        createBuy(owner, {
          portfolioId,
          effectiveDate: "2026-01-02",
          instrumentId: instrumentA,
          quantity: "10",
          unitPrice: "50",
        }),
        2,
      ),
    ];

    const projection = reduceLedger(entries);
    const valuation = valuePortfolio(projection, "2026-01-04", new Map());

    const result = calculatePortfolioResult(entries, projection, valuation);

    expect(result.status).toBe("incomplete");
    expect(result.unrealizedResult).toBeNull();
    expect(result.absoluteResult).toBeNull();
    // realized result and open cost remain available regardless of pricing
    expect(result.realizedResult.toPersistedString()).toBe("0");
    expect(result.totalOpenCost.toPersistedString()).toBe("500");
  });
});
