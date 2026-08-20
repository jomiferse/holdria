import { ValidationError } from "./errors";

/**
 * Centralized EUR-only policy (design.md decision "EUR-only functional
 * scope"). Every module that owns a `currency` column asserts through
 * this helper instead of scattering ad hoc `=== "EUR"` checks, so lifting
 * the restriction later is a one-file change.
 */
export const EUR = "EUR" as const;

export type Currency = typeof EUR;

export function isSupportedCurrency(value: string): value is Currency {
  return value === EUR;
}

/** Throws `ValidationError` unless `currency` is the one MVP-supported currency. */
export function assertEurCurrency(currency: string, field = "currency"): asserts currency is Currency {
  if (!isSupportedCurrency(currency)) {
    throw new ValidationError("Only EUR is currently supported. FX conversion is not available yet.", {
      [field]: ["Only EUR is currently supported."],
    });
  }
}
