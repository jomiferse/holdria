import { describe, expect, it } from "vitest";

import { ValidationError } from "@/shared/domain/errors";
import { normalizePortfolioName } from "./portfolio";

describe("normalizePortfolioName", () => {
  it("trims surrounding whitespace", () => {
    expect(normalizePortfolioName("  Retirement  ")).toBe("Retirement");
  });

  it("rejects an empty name", () => {
    expect(() => normalizePortfolioName("   ")).toThrow(ValidationError);
  });

  it("rejects a name over 80 characters", () => {
    expect(() => normalizePortfolioName("a".repeat(81))).toThrow(ValidationError);
  });

  it("accepts a name at the 80 character boundary", () => {
    expect(normalizePortfolioName("a".repeat(80))).toHaveLength(80);
  });
});
