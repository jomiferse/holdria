import DecimalJs from "decimal.js";

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
