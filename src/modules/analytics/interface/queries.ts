import type { UserId } from "@/shared/domain/user-id";

import type { ModifiedDietzResult } from "../domain/modified-dietz";
import { portfolioAnalyticsDeps } from "../application/deps";
import { calculatePortfolioModifiedDietz } from "../application/modified-dietz-return";
import { getPortfolioAnalytics, type PortfolioAnalytics } from "../application/portfolio-analytics";
import { reconstructPortfolioHistory, type PortfolioSnapshot } from "../application/portfolio-history";

export type { PortfolioAnalytics, PortfolioSnapshot, ModifiedDietzResult };

/**
 * `portfolioId` is the route param string, not re-validated against the
 * portfolio module's own branded `PortfolioId` type here — each function
 * below independently verifies `portfolioId` is owned by `ownerId` (see
 * `PortfolioAnalyticsDeps.requireOwnedPortfolio`) before reading anything
 * else, so a mistyped, nonexistent, or foreign (another owner's) id all
 * throw the same `NotFoundError` rather than ever exposing another owner's
 * data or distinguishing "not yours" from "does not exist".
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
