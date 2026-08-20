import type { Instrument } from "@/modules/instruments/domain/instrument";
import { drizzleInstrumentRepository } from "@/modules/instruments/infrastructure/drizzle-instrument-repository";
import type { PriceObservationRepository } from "@/modules/pricing/domain/price-observation-repository";
import { priceObservationRepository } from "@/modules/pricing/infrastructure/price-observation-repository";
import { listLedgerEntries } from "@/modules/transactions/application/ledger-commands";
import type { LedgerEntry, PortfolioId } from "@/modules/transactions/domain/ledger-entry";
import type { UserId } from "@/shared/domain/user-id";

/**
 * Analytics combines read models from portfolio, instruments, transactions,
 * and pricing (design.md decision 1: "analytics combines read models from
 * the other modules"; it never decides whether a ledger mutation is
 * valid). This is the seam application code depends on so unit tests can
 * substitute in-memory fakes instead of a database.
 */
export interface PortfolioAnalyticsDeps {
  listLedgerEntries(ownerId: UserId, portfolioId: PortfolioId): Promise<LedgerEntry[]>;
  listOwnedInstruments(ownerId: UserId): Promise<Instrument[]>;
  priceObservationRepository: PriceObservationRepository;
}

/** Wires analytics to the real transactions, instruments, and pricing infrastructure. */
export const portfolioAnalyticsDeps: PortfolioAnalyticsDeps = {
  listLedgerEntries,
  listOwnedInstruments: (ownerId) => drizzleInstrumentRepository.listOwned(ownerId),
  priceObservationRepository,
};

/** Today's date as `YYYY-MM-DD`, computed in UTC so the calendar day is unambiguous regardless of server timezone. */
export function todayDateOnly(): string {
  return new Date().toISOString().slice(0, 10);
}
