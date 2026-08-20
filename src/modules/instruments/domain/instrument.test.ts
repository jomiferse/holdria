import { describe, expect, it } from "vitest";

import { ValidationError } from "@/shared/domain/errors";
import { normalizeInstrumentInput } from "./instrument";

const VALID_ISIN = "US0378331005";

describe("normalizeInstrumentInput", () => {
  it("rejects an unsupported instrument type", () => {
    expect(() => normalizeInstrumentInput({ type: "BOND", name: "x" })).toThrow(ValidationError);
  });

  it("rejects a non-EUR currency", () => {
    expect(() =>
      normalizeInstrumentInput({ type: "STOCK", name: "Apple", currency: "USD" }),
    ).toThrow(ValidationError);
  });

  it("requires a valid ISIN for FUND", () => {
    expect(() => normalizeInstrumentInput({ type: "FUND", name: "World Fund" })).toThrow(ValidationError);
  });

  it("normalizes a fund's ISIN to canonical uppercase form", () => {
    const result = normalizeInstrumentInput({
      type: "FUND",
      name: "World Fund",
      isin: "us 037833 1005",
    });
    expect(result.isin).toBe(VALID_ISIN);
  });

  it("rejects an invalid ISIN even when optional (ETF/STOCK)", () => {
    expect(() =>
      normalizeInstrumentInput({ type: "STOCK", name: "Apple", isin: "not-an-isin" }),
    ).toThrow(ValidationError);
  });

  it("allows ETF/STOCK without an ISIN", () => {
    const result = normalizeInstrumentInput({ type: "STOCK", name: "Apple", ticker: "aapl", market: "nasdaq" });
    expect(result.isin).toBeNull();
    expect(result.ticker).toBe("AAPL");
    expect(result.market).toBe("NASDAQ");
  });

  it("trims and rejects an empty name", () => {
    expect(() => normalizeInstrumentInput({ type: "STOCK", name: "   " })).toThrow(ValidationError);
  });
});
