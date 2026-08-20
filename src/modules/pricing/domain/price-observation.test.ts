import { describe, expect, it } from "vitest";

import { parseEffectiveDate, parsePriceCurrency, parsePriceValue } from "@/modules/pricing/domain/price-observation";
import { ValidationError } from "@/shared/domain/errors";

describe("parsePriceValue", () => {
  it("accepts a positive decimal amount", () => {
    expect(parsePriceValue("12.3456").toString()).toBe("12.3456");
  });

  it.each(["0", "-1", "not-a-number", "Infinity", "NaN"])("rejects %s", (value) => {
    expect(() => parsePriceValue(value)).toThrow(ValidationError);
  });

  // Finding: "Precision policy" — `price_observations.price` is the same
  // `numeric(20, 8)` policy as `Money`/`Quantity` (see
  // `shared/domain/decimal.ts`), enforced before persistence rather than
  // silently rounded or hard-rejected by PostgreSQL.
  it("rejects a price with more decimal places than the supported precision", () => {
    expect(() => parsePriceValue("1.123456789")).toThrow(ValidationError);
  });

  it("rejects a price with more integer digits than the supported precision", () => {
    expect(() => parsePriceValue("1000000000000")).toThrow(ValidationError);
  });

  it("accepts a price at exactly the supported precision boundary", () => {
    expect(() => parsePriceValue("999999999999.12345678")).not.toThrow();
  });
});

describe("parsePriceCurrency", () => {
  it("accepts EUR", () => {
    expect(parsePriceCurrency("EUR")).toBe("EUR");
  });

  it.each(["USD", "gbp", ""])("rejects %s", (value) => {
    expect(() => parsePriceCurrency(value)).toThrow(ValidationError);
  });
});

describe("parseEffectiveDate", () => {
  it("accepts a well-formed date", () => {
    expect(parseEffectiveDate("2026-08-20")).toBe("2026-08-20");
  });

  it.each(["2026-13-40", "20-08-2026", "not-a-date", ""])("rejects %s", (value) => {
    expect(() => parseEffectiveDate(value)).toThrow(ValidationError);
  });

  // Finding: "Strict financial date validation" — `parseEffectiveDate`
  // reuses the shared `DateOnly` parser, which re-derives year/month/day
  // from the constructed calendar date and rejects any mismatch, instead
  // of the previous `Date.parse`-based check, which silently rolled an
  // impossible date like "2026-02-30" forward into "2026-03-02".

  it.each(["2026-02-30", "2026-02-31", "2026-04-31", "2026-06-31", "2026-09-31", "2026-11-31"])(
    "rejects the impossible calendar day %s instead of normalizing it into the next month",
    (value) => {
      expect(() => parseEffectiveDate(value)).toThrow(ValidationError);
    },
  );

  it.each(["2026-01-32", "2026-01-00"])("rejects the invalid day %s", (value) => {
    expect(() => parseEffectiveDate(value)).toThrow(ValidationError);
  });

  it.each(["2026-00-15", "2026-13-15"])("rejects the invalid month %s", (value) => {
    expect(() => parseEffectiveDate(value)).toThrow(ValidationError);
  });

  it("accepts February 29 in a leap year", () => {
    expect(parseEffectiveDate("2024-02-29")).toBe("2024-02-29");
  });

  it("rejects February 29 in a non-leap year instead of normalizing it into March 1", () => {
    expect(() => parseEffectiveDate("2026-02-29")).toThrow(ValidationError);
  });

  it("rejects February 29 in a century non-leap year (2100, divisible by 100 but not 400)", () => {
    expect(() => parseEffectiveDate("2100-02-29")).toThrow(ValidationError);
  });

  it("accepts February 29 in a quadricentennial leap year (2000, divisible by 400)", () => {
    expect(parseEffectiveDate("2000-02-29")).toBe("2000-02-29");
  });

  it("does not normalize — the parsed value is byte-for-byte the valid input, not a rolled-over date", () => {
    expect(parseEffectiveDate("2026-01-31")).toBe("2026-01-31");
  });
});
