import { NotFoundError } from "@/shared/domain/errors";
import { assertEurCurrency } from "@/shared/domain/currency";
import type { Actor } from "@/modules/identity/application/actor";
import { normalizePortfolioName, PORTFOLIO_CURRENCY, type Portfolio, type PortfolioId } from "../domain/portfolio";
import type { PortfolioRepository } from "./portfolio-repository";

export interface PortfolioCommandDeps {
  repository: PortfolioRepository;
}

export interface CreatePortfolioInput {
  name: string;
  /** Always EUR in the MVP; accepted so a non-EUR request can be rejected explicitly (see EUR-only spec). */
  currency?: string;
}

export async function createPortfolio(
  deps: PortfolioCommandDeps,
  actor: Actor,
  input: CreatePortfolioInput,
): Promise<Portfolio> {
  assertEurCurrency(input.currency ?? PORTFOLIO_CURRENCY);
  const name = normalizePortfolioName(input.name);
  return deps.repository.create(actor.userId, name);
}

export interface RenamePortfolioInput {
  id: PortfolioId;
  name: string;
}

export async function renamePortfolio(
  deps: PortfolioCommandDeps,
  actor: Actor,
  input: RenamePortfolioInput,
): Promise<Portfolio> {
  const name = normalizePortfolioName(input.name);
  const updated = await deps.repository.rename(actor.userId, input.id, name);

  if (!updated) {
    throw new NotFoundError("Portfolio not found.");
  }

  return updated;
}

export async function deletePortfolio(
  deps: PortfolioCommandDeps,
  actor: Actor,
  id: PortfolioId,
): Promise<void> {
  const deleted = await deps.repository.delete(actor.userId, id);

  if (!deleted) {
    throw new NotFoundError("Portfolio not found.");
  }
}
