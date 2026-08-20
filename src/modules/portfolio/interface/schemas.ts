import { z } from "zod";

/**
 * Shape-level validation for portfolio Server Action input. Deeper
 * invariants (trimmed length, EUR-only) are re-enforced by the domain and
 * application layer so they hold for every caller, not only forms — see
 * `normalizePortfolioName` and `assertEurCurrency`.
 */
export const createPortfolioSchema = z.object({
  name: z.string().min(1, "Portfolio name is required."),
});

export const renamePortfolioSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1, "Portfolio name is required."),
});

export const deletePortfolioSchema = z.object({
  id: z.string().min(1),
});
