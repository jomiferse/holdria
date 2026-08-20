import DecimalJs from "decimal.js";

import { ValidationError } from "@/shared/domain/errors";

/**
 * The one decimal type every financial calculation in Holdria must use.
 *
 * JavaScript `number` cannot represent decimal currency and quantity
 * values exactly (see design.md "Keep financial calculations pure and
 * deterministic"), so no domain or application code may parse a
 * PostgreSQL `numeric` string into a `number`, add/subtract/multiply
 * `number`s that represent money or units, or round with `Math.round`
 * and friends. Convert at the persistence boundary via `toDecimal` and
 * back via `Decimal#toString()` (numeric columns are stored/read as
 * strings; see `src/db/schema`).
 *
 * A local `DecimalJs.clone()` keeps this configuration isolated from any
 * other library that might import `decimal.js` with different settings.
 */
export const FinancialDecimal = DecimalJs.clone({
  precision: 40,
  rounding: DecimalJs.ROUND_HALF_UP,
  toExpNeg: -40,
  toExpPos: 40,
});

export type Decimal = InstanceType<typeof FinancialDecimal>;

/**
 * Parses a trusted numeric string (a PostgreSQL `numeric` column read
 * through Drizzle, or an already-validated domain value) into a
 * `Decimal`. Throws on malformed input; callers validating untrusted
 * user input should use a `Money`/`Quantity` factory instead so failures
 * surface as a `ValidationError`.
 */
export function toDecimal(value: string | number | Decimal): Decimal {
  return new FinancialDecimal(value);
}

export const ZERO: Decimal = new FinancialDecimal(0);

/**
 * The single supported precision/magnitude policy for every stored
 * financial `Decimal` — `Money` amounts, `Quantity` values, and manual
 * price observations alike (finding: "Precision policy"). Every one of
 * those is a PostgreSQL `numeric(20, 8)` column (see
 * `transactions/infrastructure/schema.ts` and
 * `pricing/infrastructure/schema.ts`), so this constant pair is that
 * column definition's single source of truth: change one, change both
 * together, or a value this module accepts could still be silently
 * rounded (excess decimal places) or hard-rejected with a raw PostgreSQL
 * "numeric field overflow" error (excess integer digits) at the
 * persistence boundary instead of failing validation cleanly.
 */
export const SUPPORTED_NUMERIC_PRECISION = 20;
export const SUPPORTED_NUMERIC_SCALE = 8;
export const SUPPORTED_NUMERIC_MAX_INTEGER_DIGITS = SUPPORTED_NUMERIC_PRECISION - SUPPORTED_NUMERIC_SCALE;

/**
 * Rejects a `Decimal` that a `numeric(20, 8)` column cannot store exactly
 * — more than 8 digits after the decimal point (PostgreSQL would silently
 * round these, not reject them) or more than 12 digits before it
 * (PostgreSQL would hard-reject these with a raw "numeric field overflow"
 * error). Every financial value-object factory that accepts untrusted
 * input (`Money`, `Quantity`, manual price observations) calls this before
 * returning, so an out-of-range value fails as an ordinary
 * `ValidationError` naming the field, before ever reaching persistence —
 * explicit validation instead of surprising database coercion.
 */
export function assertWithinSupportedPrecision(decimal: Decimal, field: string): void {
  const [integerPart, fractionalPart = ""] = decimal.abs().toFixed().split(".");
  if (fractionalPart.length > SUPPORTED_NUMERIC_SCALE) {
    throw new ValidationError(`${field} must not have more than ${SUPPORTED_NUMERIC_SCALE} decimal places`, {
      [field]: [`Must not have more than ${SUPPORTED_NUMERIC_SCALE} decimal places`],
    });
  }
  const integerDigits = integerPart.replace(/^0+(?=\d)/, "").length;
  if (integerDigits > SUPPORTED_NUMERIC_MAX_INTEGER_DIGITS) {
    throw new ValidationError(`${field} must not have more than ${SUPPORTED_NUMERIC_MAX_INTEGER_DIGITS} digits before the decimal point`, {
      [field]: [`Must not have more than ${SUPPORTED_NUMERIC_MAX_INTEGER_DIGITS} digits before the decimal point`],
    });
  }
}
