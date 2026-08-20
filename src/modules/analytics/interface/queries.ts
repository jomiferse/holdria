import type { UserId } from "@/shared/domain/user-id";

import type { ModifiedDietzResult } from "../domain/modified-dietz";
import { portfolioAnalyticsDeps } from "../application/deps";
import { calculatePortfolioModifiedDietz } from "../application/modified-dietz-return";
import { getPortfolioAnalytics, type PortfolioAnalytics } from "../application/portfolio-analytics";
import { reconstructPortfolioHistory, type PortfolioSnapshot } from "../application/portfolio-history";

export type { PortfolioAnalytics, PortfolioSnapshot, ModifiedDietzResult };

/**
 * `portfolioId` is the route param string. It is not re-validated against
 * the portfolio module's own branded `PortfolioId` here — every analytics
 * read is itself scoped by `ownerId` down to `ledger_entries`, so a
 * mistyped or foreign id simply yields an empty ledger and a zero-value
 * portfolio, never another owner's data.
 */

/** Server Component read model: current valuation, result, and allocation for one owned portfolio. */
export async function getPortfolioAnalyticsView(ownerId: UserId, portfolioId: string): Promise<PortfolioAnalytics> {
  return getPortfolioAnalytics(portfolioAnalyticsDeps, ownerId, portfolioId);
}

/** Server Component read model: since-inception Modified Dietz return for one owned portfolio. */
export async function getPortfolioReturnView(ownerId: UserId, portfolioId: string): Promise<ModifiedDietzResult> {
  return calculatePortfolioModifiedDietz(portfolioAnalyticsDeps, ownerId, portfolioId);
}

/** Server Component read model: reconstructed historical evolution for one owned portfolio. */
export async function getPortfolioHistoryView(ownerId: UserId, portfolioId: string): Promise<PortfolioSnapshot[]> {
  return reconstructPortfolioHistory(portfolioAnalyticsDeps, ownerId, portfolioId);
}
