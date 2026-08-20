import { EUR, type Currency } from "@/shared/domain/currency";
import { ValidationError } from "@/shared/domain/errors";
import type { UserId } from "@/shared/domain/user-id";

/** Branded identifier for a portfolio row. Opaque outside this module. */
export type PortfolioId = string & { readonly __brand: "PortfolioId" };

export function toPortfolioId(value: string): PortfolioId {
  return value as PortfolioId;
}

/** A user-owned, EUR-denominated portfolio (see design.md decision 5). */
export interface Portfolio {
  readonly id: PortfolioId;
  readonly ownerId: UserId;
  readonly name: string;
  readonly currency: Currency;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

const NAME_MAX_LENGTH = 80;

/**
 * Trims and validates a portfolio name. Shared by create and rename so
 * both paths enforce the identical invariant regardless of caller
 * (Server Action, script, or test).
 */
export function normalizePortfolioName(rawName: string): string {
  const name = rawName.trim();

  if (name.length === 0) {
    throw new ValidationError("Portfolio name is required.", {
      name: ["Portfolio name is required."],
    });
  }

  if (name.length > NAME_MAX_LENGTH) {
    throw new ValidationError(`Portfolio name must be ${NAME_MAX_LENGTH} characters or fewer.`, {
      name: [`Must be ${NAME_MAX_LENGTH} characters or fewer.`],
    });
  }

  return name;
}

export { EUR as PORTFOLIO_CURRENCY };
