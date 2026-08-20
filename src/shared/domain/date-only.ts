import { ValidationError } from "@/shared/domain/errors";

const DATE_ONLY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * A validated calendar date without a time or timezone component.
 *
 * Financial dates (ledger effective dates, price observation dates,
 * valuation dates) are date-only per design.md decision 7 — they never
 * carry a time-of-day or timezone, so two entries "on the same day" are
 * unambiguous regardless of where the server or the user is. Audit
 * timestamps (`created_at`/`updated_at`) are a separate `timestamptz`
 * concern and are not represented by this type.
 *
 * The underlying value is always a `YYYY-MM-DD` string — the same shape
 * Drizzle reads/writes for a `date` column in `{ mode: "string" }` — so
 * round-tripping through persistence never goes through `Date`/`number`
 * and never risks a UTC/local timezone shift.
 */
export class DateOnly {
  private constructor(readonly value: string) {}

  /** Parses and validates a `YYYY-MM-DD` string, throwing `ValidationError` on any other shape or an invalid calendar date. */
  static parse(value: string, field = "date"): DateOnly {
    const match = DATE_ONLY_PATTERN.exec(value.trim());
    if (!match) {
      throw new ValidationError(`${field} must be a YYYY-MM-DD date`, {
        [field]: ["Must be a YYYY-MM-DD date"],
      });
    }
    const [, yearStr, monthStr, dayStr] = match;
    const year = Number(yearStr);
    const month = Number(monthStr);
    const day = Number(dayStr);
    const asDate = new Date(Date.UTC(year, month - 1, day));
    const isRealCalendarDate =
      asDate.getUTCFullYear() === year &&
      asDate.getUTCMonth() === month - 1 &&
      asDate.getUTCDate() === day;
    if (!isRealCalendarDate) {
      throw new ValidationError(`${field} must be a valid calendar date`, {
        [field]: ["Must be a valid calendar date"],
      });
    }
    return new DateOnly(`${yearStr}-${monthStr}-${dayStr}`);
  }

  /** Wraps an already-validated `YYYY-MM-DD` string (e.g. read from persistence). */
  static fromPersisted(value: string): DateOnly {
    return new DateOnly(value);
  }

  /** `-1` if this date is before `other`, `1` if after, `0` if the same day. */
  compareTo(other: DateOnly): number {
    if (this.value < other.value) return -1;
    if (this.value > other.value) return 1;
    return 0;
  }

  equals(other: DateOnly): boolean {
    return this.value === other.value;
  }

  toString(): string {
    return this.value;
  }
}
