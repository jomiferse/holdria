import { describe, expect, it } from "vitest";

import { createBuy, createContribution } from "@/modules/transactions/domain/ledger-entry";
import type { LedgerEntry } from "@/modules/transactions/domain/ledger-entry";

import { calculatePortfolioModifiedDietz } from "./modified-dietz-return";
import { getPortfolioAnalytics } from "./portfolio-analytics";
import { instrumentId, makeDeps, owner, portfolioId, priceObservation, seq } from "./test-support";

describe("getPortfolioAnalytics", () => {
  it("golden case: a contribution, a buy, and a later price yield a complete valuation and positive result", async () => {
    const entries: LedgerEntry[] = [
      seq(createContribution(owner, { portfolioId, effectiveDate: "2026-01-01", cashAmount: "1000" }), 1),
      seq(
        createBuy(owner, {
          portfolioId,
          effectiveDate: "2026-01-02",
          instrumentId,
          quantity: "10",
          unitPrice: "50",
        }),
        2,
      ),
    ];
    const deps = makeDeps(entries, [priceObservation("2026-01-02", "50"), priceObservation("2026-02-01", "70")]);

    const analytics = await getPortfolioAnalytics(deps, owner, portfolioId, "2026-02-01");

    expect(analytics.valuation.status).toBe("complete");
    // cash 1000 - 500 = 500, position value 10*70 = 700 -> total 1200
    expect(analytics.valuation.totalValue?.toPersistedString()).toBe("1200");
    // absolute result = 1200 + 0 - 1000 = 200
    expect(analytics.result.absoluteResult?.toPersistedString()).toBe("200");
    expect(analytics.allocation.status).toBe("complete");
  });

  it("a future-dated contribution does not affect today's absolute result or cumulative flows", async () => {
    const entries: LedgerEntry[] = [
      seq(createContribution(owner, { portfolioId, effectiveDate: "2026-01-01", cashAmount: "1000" }), 1),
      // Dated after the requested asOfDate: must not be reflected yet.
      seq(createContribution(owner, { portfolioId, effectiveDate: "2026-03-01", cashAmount: "5000" }), 2),
    ];
    const deps = makeDeps(entries, []);

    const analytics = await getPortfolioAnalytics(deps, owner, portfolioId, "2026-02-01");

    // cash as of 2026-02-01 is just the first contribution.
    expect(analytics.valuation.totalValue?.toPersistedString()).toBe("1000");
    // absolute result = 1000 (value) + 0 (withdrawals) - 1000 (contributions as of date) = 0
    expect(analytics.result.absoluteResult?.toPersistedString()).toBe("0");
    expect(analytics.result.cumulativeFlows.contributions.toPersistedString()).toBe("1000");
  });

  it("no price for a held instrument leaves valuation, result, and allocation explicitly incomplete", async () => {
    const entries: LedgerEntry[] = [
      seq(createContribution(owner, { portfolioId, effectiveDate: "2026-01-01", cashAmount: "1000" }), 1),
      seq(
        createBuy(owner, {
          portfolioId,
          effectiveDate: "2026-01-02",
          instrumentId,
          quantity: "10",
          unitPrice: "50",
        }),
        2,
      ),
    ];
    const deps = makeDeps(entries, []);

    const analytics = await getPortfolioAnalytics(deps, owner, portfolioId, "2026-02-01");

    expect(analytics.valuation.status).toBe("incomplete");
    expect(analytics.valuation.totalValue).toBeNull();
    expect(analytics.result.absoluteResult).toBeNull();
    expect(analytics.allocation.status).toBe("incomplete");
  });
});

describe("calculatePortfolioModifiedDietz", () => {
  it("golden case: since-inception return from one contribution, one buy, and an ending price", async () => {
    const entries: LedgerEntry[] = [
      seq(createContribution(owner, { portfolioId, effectiveDate: "2026-01-01", cashAmount: "1000" }), 1),
      seq(
        createBuy(owner, {
          portfolioId,
          effectiveDate: "2026-01-01",
          instrumentId,
          quantity: "10",
          unitPrice: "100",
        }),
        2,
      ),
    ];
    const deps = makeDeps(entries, [priceObservation("2026-01-01", "100"), priceObservation("2026-01-31", "110")]);

    const result = await calculatePortfolioModifiedDietz(deps, owner, portfolioId, { end: "2026-01-31" });

    expect(result.status).toBe("available");
    if (result.status !== "available") throw new Error("unreachable");
    expect(result.periodStart).toBe("2026-01-01");
    // beginning value 0, ending value 1100, one flow of 1000 with weight 1 (day one) -> (1100-0-1000)/(0+1000) = 0.1
    expect(result.returnRate.toFixed(10)).toBe("0.1000000000");
  });

  it("no contributions yields an unavailable return, not zero", async () => {
    const deps = makeDeps([], []);

    const result = await calculatePortfolioModifiedDietz(deps, owner, portfolioId, { end: "2026-01-31" });

    expect(result.status).toBe("unavailable");
  });
});
