import { describe, expect, it } from "vitest";

import type { Instrument } from "@/modules/instruments/domain/instrument";
import { toInstrumentId as toInstrumentDomainId } from "@/modules/instruments/domain/instrument";
import type {
  NewPriceObservationInput,
  PriceObservation,
  PriceObservationEditInput,
  PriceObservationId,
} from "@/modules/pricing/domain/price-observation";
import { toInstrumentId as toPricingInstrumentId, toPriceObservationId } from "@/modules/pricing/domain/price-observation";
import type { PriceObservationRepository } from "@/modules/pricing/domain/price-observation-repository";
import { createBuy, createContribution } from "@/modules/transactions/domain/ledger-entry";
import type { LedgerEntry, PortfolioId } from "@/modules/transactions/domain/ledger-entry";
import { toDecimal } from "@/shared/domain/decimal";
import { toUserId, type UserId } from "@/shared/domain/user-id";

import type { PortfolioAnalyticsDeps } from "./deps";
import { calculatePortfolioModifiedDietz } from "./modified-dietz-return";
import { getPortfolioAnalytics } from "./portfolio-analytics";

const owner = toUserId("00000000-0000-0000-0000-000000000001");
const portfolioId = "10000000-0000-0000-0000-000000000001" as PortfolioId;
const instrumentId = "20000000-0000-0000-0000-000000000001";

function seq<T extends LedgerEntry>(entry: T, sequence: number): T {
  return { ...entry, sequence: BigInt(sequence) };
}

/** Minimal in-memory price repository: only `findLatestAsOf` is exercised by analytics. */
class FakePriceObservationRepository implements PriceObservationRepository {
  constructor(private readonly observations: PriceObservation[]) {}

  async create(_input: NewPriceObservationInput): Promise<PriceObservation> {
    throw new Error("not used in this test");
  }
  async update(_ownerId: UserId, _id: PriceObservationId, _edit: PriceObservationEditInput): Promise<PriceObservation> {
    throw new Error("not used in this test");
  }
  async delete(): Promise<void> {
    throw new Error("not used in this test");
  }
  async findOwnedById(): Promise<PriceObservation | null> {
    return null;
  }
  async listByInstrument(): Promise<PriceObservation[]> {
    return this.observations;
  }
  async findLatestAsOf(ownerId: UserId, instrumentId2: ReturnType<typeof toPricingInstrumentId>, asOfDate: string) {
    const eligible = this.observations.filter(
      (o) => o.ownerId === ownerId && o.instrumentId === instrumentId2 && o.effectiveDate <= asOfDate,
    );
    if (eligible.length === 0) return null;
    return eligible.reduce((latest, candidate) => (candidate.effectiveDate > latest.effectiveDate ? candidate : latest));
  }
}

function priceObservation(effectiveDate: string, price: string): PriceObservation {
  return {
    id: toPriceObservationId(`price-${effectiveDate}`),
    ownerId: owner,
    instrumentId: toPricingInstrumentId(instrumentId),
    price: toDecimal(price),
    currency: "EUR",
    effectiveDate,
    source: "MANUAL",
    ingestedAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

const fundInstrument: Instrument = {
  id: toInstrumentDomainId(instrumentId),
  ownerId: owner,
  type: "FUND",
  name: "Test Fund",
  isin: "IE00TEST0001",
  ticker: null,
  market: null,
  currency: "EUR",
  createdAt: new Date(),
  updatedAt: new Date(),
};

function makeDeps(entries: LedgerEntry[], observations: PriceObservation[]): PortfolioAnalyticsDeps {
  return {
    listLedgerEntries: async () => entries,
    listOwnedInstruments: async () => [fundInstrument],
    priceObservationRepository: new FakePriceObservationRepository(observations),
  };
}

describe("getPortfolioAnalytics", () => {
  it("golden case: a contribution, a buy, and a later price yield a complete valuation and positive result", async () => {
    const entries = [
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

  it("no price for a held instrument leaves valuation, result, and allocation explicitly incomplete", async () => {
    const entries = [
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
    const entries = [
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
    expect(result.returnRate.toNumber()).toBeCloseTo(0.1, 10);
  });

  it("no contributions yields an unavailable return, not zero", async () => {
    const deps = makeDeps([], []);

    const result = await calculatePortfolioModifiedDietz(deps, owner, portfolioId, { end: "2026-01-31" });

    expect(result.status).toBe("unavailable");
  });
});
