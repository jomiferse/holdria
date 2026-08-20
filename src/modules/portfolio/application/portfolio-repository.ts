import type { UserId } from "@/shared/domain/user-id";
import type { Portfolio, PortfolioId } from "../domain/portfolio";

/**
 * Owner-scoped persistence port for portfolios (design.md decision 4:
 * repositories expose owned operations, never unrestricted lookup).
 * Application commands and queries depend on this interface, not on
 * Drizzle, so they stay testable without a database.
 */
export interface PortfolioRepository {
  listOwned(ownerId: UserId): Promise<Portfolio[]>;
  findOwnedById(ownerId: UserId, id: PortfolioId): Promise<Portfolio | null>;
  create(ownerId: UserId, name: string): Promise<Portfolio>;
  /** Returns the updated portfolio, or `null` if `id` is not owned by `ownerId`. */
  rename(ownerId: UserId, id: PortfolioId, name: string): Promise<Portfolio | null>;
  /** Returns `true` if a row owned by `ownerId` was deleted. */
  delete(ownerId: UserId, id: PortfolioId): Promise<boolean>;
}
