import { describe, expect, it } from "vitest";

import { createBuy, createContribution, createSell } from "@/modules/transactions/domain/ledger-entry";
import type { LedgerEntry } from "@/modules/transactions/domain/ledger-entry";

import { reconstructPortfolioHistory } from "./portfolio-history";
import { instrumentId, makeDeps, owner, portfolioId, priceObservation, seq } from "./test-support";

const entries: LedgerEntry[] = [
  seq(createContribution(owner, { portfolioId, effectiveDate: "2026-01-01", cashAmount: "1000" }), 1),
  seq(
    createBuy(owner, { portfolioId, effectiveDate: "2026-01-05", instrumentId, quantity: "10", unitPrice: "100" }),
    2,
  ),
];

describe("reconstructPortfolioHistory", () => {
  it("returns snapshots in chronological order", async () => {
    const deps = makeDeps(entries, [priceObservation("2026-01-05", "100")]);

    const snapshots = await reconstructPortfolioHistory(deps, owner, portfolioId);

    const dates = snapshots.map((s) => s.date);
    expect(dates).toEqual([...dates].sort());
  });

  it("includes a snapshot for a price-only date with no ledger activity on it", async () => {
    // Prices on the 31st of Jan/Feb/Mar with no ledger entries on those
    // dates: the chart must still reconstruct a point for each, since
    // dated prices are one of the two authoritative sources for history.
    const deps = makeDeps(entries, [
      priceObservation("2026-01-05", "100"),
      priceObservation("2026-01-31", "105"),
      priceObservation("2026-02-28", "110"),
      priceObservation("2026-03-31", "120"),
    ]);

    const snapshots = await reconstructPortfolioHistory(deps, owner, portfolioId);
    const dates = snapshots.map((s) => s.date);

    expect(dates).toEqual(expect.arrayContaining(["2026-01-31", "2026-02-28", "2026-03-31"]));
    const marchPoint = snapshots.find((s) => s.date === "2026-03-31");
    expect(marchPoint?.valuation.status).toBe("complete");
    // cash 1000 - 1000 = 0; position 10 * 120 = 1200 -> total 1200
    expect(marchPoint?.valuation.totalValue?.toPersistedString()).toBe("1200");
  });

  it("marks an early date incomplete when the held instrument has no eligible price yet", async () => {
    // Only a price after the buy; the buy date itself has no eligible price.
    const deps = makeDeps(entries, [priceObservation("2026-02-01", "100")]);

    const snapshots = await reconstructPortfolioHistory(deps, owner, portfolioId);

    const buyDatePoint = snapshots.find((s) => s.date === "2026-01-05");
    expect(buyDatePoint?.valuation.status).toBe("incomplete");
    expect(buyDatePoint?.valuation.unpricedInstrumentIds).toEqual([instrumentId]);
  });

  it("reflects a price correction the next time history is requested (no persisted snapshot)", async () => {
    const first = await reconstructPortfolioHistory(makeDeps(entries, [priceObservation("2026-01-05", "100")]), owner, portfolioId);
    const firstPoint = first.find((s) => s.date === "2026-01-05");
    expect(firstPoint?.valuation.totalValue?.toPersistedString()).toBe("1000"); // cash 0 + 10*100

    const corrected = await reconstructPortfolioHistory(
      makeDeps(entries, [priceObservation("2026-01-05", "150")]),
      owner,
      portfolioId,
    );
    const correctedPoint = corrected.find((s) => s.date === "2026-01-05");
    expect(correctedPoint?.valuation.totalValue?.toPersistedString()).toBe("1500"); // cash 0 + 10*150
  });

  it("reflects a price deletion by falling back to the next eligible earlier price or unpriced", async () => {
    const withPrice = await reconstructPortfolioHistory(
      makeDeps(entries, [priceObservation("2026-01-05", "100")]),
      owner,
      portfolioId,
    );
    expect(withPrice.find((s) => s.date === "2026-01-05")?.valuation.status).toBe("complete");

    const priceDeleted = await reconstructPortfolioHistory(makeDeps(entries, []), owner, portfolioId);
    expect(priceDeleted.find((s) => s.date === "2026-01-05")?.valuation.status).toBe("incomplete");
  });

  it("reflects a ledger correction (a later sell) the next time history is requested", async () => {
    const withoutSell = await reconstructPortfolioHistory(
      makeDeps(entries, [priceObservation("2026-01-05", "100"), priceObservation("2026-02-01", "100")]),
      owner,
      portfolioId,
    );
    const beforeSellPoint = withoutSell.find((s) => s.date === "2026-02-01");
    expect(beforeSellPoint?.valuation.totalValue?.toPersistedString()).toBe("1000"); // 10 units * 100

    const withSell: LedgerEntry[] = [
      ...entries,
      seq(
        createSell(owner, { portfolioId, effectiveDate: "2026-02-01", instrumentId, quantity: "4", unitPrice: "100" }),
        3,
      ),
    ];
    const afterSell = await reconstructPortfolioHistory(
      makeDeps(withSell, [priceObservation("2026-01-05", "100"), priceObservation("2026-02-01", "100")]),
      owner,
      portfolioId,
    );
    const afterSellPoint = afterSell.find((s) => s.date === "2026-02-01");
    // cash 400 (from the sell) + 6 units * 100 = 1000
    expect(afterSellPoint?.valuation.totalValue?.toPersistedString()).toBe("1000");
    const projectedUnits = [...afterSellPoint!.valuation.positions][0]?.units.value.toFixed();
    expect(projectedUnits).toBe("6");
  });

  it("omits a ledger entry dated after the reconstructed point (never a future leak)", async () => {
    const withFuture: LedgerEntry[] = [
      ...entries,
      seq(createContribution(owner, { portfolioId, effectiveDate: "2026-06-01", cashAmount: "9000" }), 3),
    ];
    const deps = makeDeps(withFuture, [priceObservation("2026-01-05", "100")]);

    const snapshots = await reconstructPortfolioHistory(deps, owner, portfolioId, ["2026-01-05"]);

    // cash 0 + 10*100 = 1000; the far-future contribution must not appear.
    expect(snapshots[0]?.valuation.totalValue?.toPersistedString()).toBe("1000");
  });

  it("honors an explicit date list instead of the default policy", async () => {
    const deps = makeDeps(entries, [priceObservation("2026-01-05", "100")]);

    const snapshots = await reconstructPortfolioHistory(deps, owner, portfolioId, ["2026-01-01", "2026-01-05"]);

    expect(snapshots.map((s) => s.date)).toEqual(["2026-01-01", "2026-01-05"]);
  });

  it("repeated reconstruction with identical inputs is reproducible", async () => {
    const deps = makeDeps(entries, [priceObservation("2026-01-05", "100")]);

    const first = await reconstructPortfolioHistory(deps, owner, portfolioId, ["2026-01-05"]);
    const second = await reconstructPortfolioHistory(deps, owner, portfolioId, ["2026-01-05"]);

    expect(first[0]?.valuation.totalValue?.toPersistedString()).toBe(second[0]?.valuation.totalValue?.toPersistedString());
    expect(first[0]?.valuation.status).toBe(second[0]?.valuation.status);
  });
});
