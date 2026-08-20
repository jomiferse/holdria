import { NotFoundError } from "@/shared/domain/errors";
import type { Actor } from "@/modules/identity/application/actor";
import type { Portfolio, PortfolioId } from "../domain/portfolio";
import type { PortfolioRepository } from "./portfolio-repository";

export interface PortfolioQueryDeps {
  repository: PortfolioRepository;
}

/** Lists every portfolio the actor owns. Never returns another user's data. */
export async function listPortfolios(deps: PortfolioQueryDeps, actor: Actor): Promise<Portfolio[]> {
  return deps.repository.listOwned(actor.userId);
}

/** Loads one owned portfolio, or throws `NotFoundError` if it does not exist or belongs to someone else. */
export async function getPortfolio(
  deps: PortfolioQueryDeps,
  actor: Actor,
  id: PortfolioId,
): Promise<Portfolio> {
  const portfolio = await deps.repository.findOwnedById(actor.userId, id);

  if (!portfolio) {
    throw new NotFoundError("Portfolio not found.");
  }

  return portfolio;
}
