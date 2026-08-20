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
});
