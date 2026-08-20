import { ValidationError } from "@/shared/domain/errors";

import { assertWithinSupportedPrecision, FinancialDecimal, toDecimal, type Decimal } from "./decimal";

/**
 * Holdria is EUR-only for the MVP (see design.md decision 5 and 7), but
 * the type is kept distinct from a bare string literal so a future
 * multi-currency change touches one place.
 */
export const EUR = "EUR" as const;
export type Currency = typeof EUR;

/**
 * An exact decimal monetary amount in a known currency.
 *
 * `Money` never wraps a JavaScript `number`. Construct it from a trusted
 * `Decimal`/numeric-string (`Money.fromDecimal`, used for values already
 * validated or read from PostgreSQL `numeric` columns) or from untrusted
 * user input (`Money.fromInput`, which validates and throws
 * `ValidationError`). Every arithmetic operation returns a new `Money`;
 * instances are immutable.
 */
export class Money {
  private constructor(
    readonly amount: Decimal,
    readonly currency: Currency,
  ) {}

  static zero(currency: Currency = EUR): Money {
    return new Money(new FinancialDecimal(0), currency);
  }

  /** Wraps an already-validated decimal amount (e.g. from persistence). */
  static fromDecimal(amount: Decimal | string | number, currency: Currency = EUR): Money {
    return new Money(toDecimal(amount), currency);
  }

  /**
   * Validates untrusted input (a form field, a Zod-parsed string) as a
   * strictly positive monetary amount and returns `Money`, or throws
   * `ValidationError` identifying the field.
   */
  static fromInput(value: string | number, field: string, currency: Currency = EUR): Money {
    const decimal = parseFinancialInput(value, field);
    if (decimal.lte(0)) {
      throw new ValidationError(`${field} must be a positive amount`, {
        [field]: ["Must be greater than zero"],
      });
    }
    return new Money(decimal, currency);
  }

  /**
   * Validates untrusted input as a non-negative monetary amount (fees may
   * legitimately be zero) and returns `Money`, or throws `ValidationError`.
   */
  static fromNonNegativeInput(
    value: string | number,
    field: string,
    currency: Currency = EUR,
  ): Money {
    const decimal = parseFinancialInput(value, field);
    if (decimal.lt(0)) {
      throw new ValidationError(`${field} must not be negative`, {
        [field]: ["Must be zero or greater"],
      });
    }
    return new Money(decimal, currency);
  }

  private assertSameCurrency(other: Money): void {
    if (other.currency !== this.currency) {
      throw new Error(`Cannot combine ${this.currency} with ${other.currency}`);
    }
  }

  plus(other: Money): Money {
    this.assertSameCurrency(other);
    return new Money(this.amount.plus(other.amount), this.currency);
  }

  minus(other: Money): Money {
    this.assertSameCurrency(other);
    return new Money(this.amount.minus(other.amount), this.currency);
  }

  /** Scales this amount by a plain decimal factor (e.g. a `Quantity`'s value), not by another `Money`. */
  times(factor: Decimal | string | number): Money {
    return new Money(this.amount.times(factor), this.currency);
  }

  /** Divides this amount by a plain decimal divisor (e.g. a `Quantity`'s value), not by another `Money`. */
  dividedBy(divisor: Decimal | string | number): Money {
    return new Money(this.amount.dividedBy(divisor), this.currency);
  }

  isPositive(): boolean {
    return this.amount.isPositive() && !this.amount.isZero();
  }

  isNegative(): boolean {
    return this.amount.isNegative();
  }

  isZero(): boolean {
    return this.amount.isZero();
  }

  compareTo(other: Money): number {
    this.assertSameCurrency(other);
    return this.amount.comparedTo(other.amount);
  }

  /** The raw decimal string persisted to a PostgreSQL `numeric` column. */
  toPersistedString(): string {
    return this.amount.toFixed();
  }
}

/**
 * Centralized EUR display formatting. Calculation code never formats
 * currency itself; presentation always goes through this function so
 * rounding/locale/symbol policy lives in one place (design.md decision 7).
 *
 * Uses a fixed `de-DE` locale (comma decimal separator, trailing `€`)
 * regardless of the viewer's browser locale, so every user sees the same
 * unambiguous formatting for shared/exported figures.
 */
const eurFormatter = new Intl.NumberFormat("de-DE", {
  style: "currency",
  currency: "EUR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formatEur(amount: Money | Decimal | string | number): string {
  const decimal = amount instanceof Money ? amount.amount : toDecimal(amount);
  // Intl.NumberFormat only accepts number/bigint; the conversion here is
  // presentation-only rounding to 2 display decimals, never a
  // calculation step, and decimal.js's own rounding produces the exact
  // fixed-point string Intl then formats.
  return eurFormatter.format(Number(decimal.toFixed(2)));
}

/** Shared untrusted-input parsing used by `Money` and `Quantity` factories. */
export function parseFinancialInput(value: string | number, field: string): Decimal {
  if (typeof value === "number" && !Number.isFinite(value)) {
    throw new ValidationError(`${field} must be a finite number`, {
      [field]: ["Must be a finite number"],
    });
  }
  const raw = String(value).trim();
  if (raw.length === 0) {
    throw new ValidationError(`${field} is required`, { [field]: ["Required"] });
  }
  let decimal: Decimal;
  try {
    decimal = toDecimal(raw);
  } catch {
    throw new ValidationError(`${field} must be a valid number`, {
      [field]: ["Must be a valid number"],
    });
  }
  if (!decimal.isFinite()) {
    throw new ValidationError(`${field} must be a finite number`, {
      [field]: ["Must be a finite number"],
    });
  }
  assertWithinSupportedPrecision(decimal, field);
  return decimal;
}
