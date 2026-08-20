import type { Instrument } from "@/modules/instruments/domain/instrument";
import { drizzleInstrumentRepository } from "@/modules/instruments/infrastructure/drizzle-instrument-repository";
import type { PriceObservationRepository } from "@/modules/pricing/domain/price-observation-repository";
import { priceObservationRepository } from "@/modules/pricing/infrastructure/price-observation-repository";
import { toPortfolioId } from "@/modules/portfolio/domain/portfolio";
import { drizzlePortfolioRepository } from "@/modules/portfolio/infrastructure/drizzle-portfolio-repository";
import { listLedgerEntries } from "@/modules/transactions/application/ledger-commands";
import type { LedgerEntry, PortfolioId } from "@/modules/transactions/domain/ledger-entry";
import { NotFoundError } from "@/shared/domain/errors";
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
  /**
   * Throws `NotFoundError` unless `portfolioId` is owned by `ownerId`.
   * Every exported analytics use case calls this itself before reading any
   * other data (finding: "Analytics authorization") — it does not rely on
   * route or layout protection, and a foreign portfolio id (owned by a
   * different user) produces exactly the same `NotFoundError` a
   * nonexistent id would, never a distinguishable response and never
   * another owner's data.
   */
  requireOwnedPortfolio(ownerId: UserId, portfolioId: PortfolioId): Promise<void>;
}

/** Wires analytics to the real transactions, instruments, portfolio, and pricing infrastructure. */
export const portfolioAnalyticsDeps: PortfolioAnalyticsDeps = {
  listLedgerEntries,
  listOwnedInstruments: (ownerId) => drizzleInstrumentRepository.listOwned(ownerId),
  priceObservationRepository,
  requireOwnedPortfolio: async (ownerId, portfolioId) => {
    const portfolio = await drizzlePortfolioRepository.findOwnedById(ownerId, toPortfolioId(portfolioId));
    if (!portfolio) {
      throw new NotFoundError("Portfolio not found.");
    }
  },
};

/** Today's date as `YYYY-MM-DD`, computed in UTC so the calendar day is unambiguous regardless of server timezone. */
export function todayDateOnly(): string {
  return new Date().toISOString().slice(0, 10);
}
