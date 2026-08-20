import { ValidationError } from "@/shared/domain/errors";

import { FinancialDecimal, toDecimal, type Decimal } from "./decimal";
import { parseFinancialInput } from "./money";

/**
 * An exact decimal count of instrument units (shares, fund participations).
 * Currency-less by design: a `Quantity` is always paired with a `Money`
 * unit price when it represents a trade.
 */
export class Quantity {
  private constructor(readonly value: Decimal) {}

  static zero(): Quantity {
    return new Quantity(new FinancialDecimal(0));
  }

  /** Wraps an already-validated decimal quantity (e.g. from persistence). */
  static fromDecimal(value: Decimal | string | number): Quantity {
    return new Quantity(toDecimal(value));
  }

  /**
   * Validates untrusted input as a strictly positive quantity and
   * returns `Quantity`, or throws `ValidationError` identifying the field.
   */
  static fromInput(value: string | number, field: string): Quantity {
    const decimal = parseFinancialInput(value, field);
    if (decimal.lte(0)) {
      throw new ValidationError(`${field} must be a positive quantity`, {
        [field]: ["Must be greater than zero"],
      });
    }
    return new Quantity(decimal);
  }

  plus(other: Quantity): Quantity {
    return new Quantity(this.value.plus(other.value));
  }

  minus(other: Quantity): Quantity {
    return new Quantity(this.value.minus(other.value));
  }

  isNegative(): boolean {
    return this.value.isNegative();
  }

  isZero(): boolean {
    return this.value.isZero();
  }

  compareTo(other: Quantity): number {
    return this.value.comparedTo(other.value);
  }

  /** The raw decimal string persisted to a PostgreSQL `numeric` column. */
  toPersistedString(): string {
    return this.value.toFixed();
  }
}
