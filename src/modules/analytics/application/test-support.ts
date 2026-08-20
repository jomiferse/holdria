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
import type { LedgerEntry, PortfolioId } from "@/modules/transactions/domain/ledger-entry";
import { toDecimal } from "@/shared/domain/decimal";
import { NotFoundError } from "@/shared/domain/errors";
import { toUserId, type UserId } from "@/shared/domain/user-id";

import type { PortfolioAnalyticsDeps } from "./deps";

/** Shared fixtures and fakes for analytics application-layer tests (no database). */

export const owner = toUserId("00000000-0000-0000-0000-000000000001");
export const portfolioId = "10000000-0000-0000-0000-000000000001" as PortfolioId;
export const instrumentId = "20000000-0000-0000-0000-000000000001";

/** Attaches a sequence, since `reduceLedger` requires every entry to be ordered. */
export function seq<T extends LedgerEntry>(entry: T, sequence: number): T {
  return { ...entry, sequence: BigInt(sequence) };
}

/** Minimal in-memory price repository: only `listByInstrument` and `findLatestAsOf` are exercised by analytics. */
export class FakePriceObservationRepository implements PriceObservationRepository {
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
  async listByInstrument(ownerId2: UserId, instrumentId2: ReturnType<typeof toPricingInstrumentId>): Promise<PriceObservation[]> {
    return this.observations.filter((o) => o.ownerId === ownerId2 && o.instrumentId === instrumentId2);
  }
  async findLatestAsOf(ownerId2: UserId, instrumentId2: ReturnType<typeof toPricingInstrumentId>, asOfDate: string) {
    const eligible = this.observations.filter(
      (o) => o.ownerId === ownerId2 && o.instrumentId === instrumentId2 && o.effectiveDate <= asOfDate,
    );
    if (eligible.length === 0) return null;
    return eligible.reduce((latest, candidate) => (candidate.effectiveDate > latest.effectiveDate ? candidate : latest));
  }
}

export function priceObservation(effectiveDate: string, price: string): PriceObservation {
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

export const fundInstrument: Instrument = {
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

/**
 * `owned` defaults to `true` (the actor owns `portfolioId`); pass `false`
 * to simulate a foreign or nonexistent portfolio for cross-tenant
 * authorization tests (finding: "Analytics authorization") — `deps` then
 * behaves exactly like the real `requireOwnedPortfolio`, throwing
 * `NotFoundError` before any other dependency is read.
 */
export function makeDeps(
  entries: LedgerEntry[],
  observations: PriceObservation[],
  owned = true,
): PortfolioAnalyticsDeps {
  return {
    listLedgerEntries: async () => entries,
    listOwnedInstruments: async () => [fundInstrument],
    priceObservationRepository: new FakePriceObservationRepository(observations),
    requireOwnedPortfolio: async () => {
      if (!owned) {
        throw new NotFoundError("Portfolio not found.");
      }
    },
  };
}
