import { describe, expect, it } from "vitest";

import { FinancialDecimal } from "@/shared/domain/decimal";
import { Money } from "@/shared/domain/money";

import { calculateModifiedDietz } from "./modified-dietz";

describe("calculateModifiedDietz", () => {
  it("golden case: a single mid-period contribution is weighted by remaining days", () => {
    // 2026 is not a leap concern here: Jan 1 -> Jan 31 is a 30-day period.
    // A 100 contribution on day 11 (20 days remaining of 30) has weight 20/30.
    const result = calculateModifiedDietz(
      "2026-01-01",
      "2026-01-31",
      Money.fromDecimal("1000"),
      Money.fromDecimal("1150"),
      [{ date: "2026-01-11", amount: Money.fromDecimal("100") }],
    );

    expect(result.status).toBe("available");
    if (result.status !== "available") throw new Error("unreachable");
    // denominator = 1000 + 100*(20/30); numerator = 1150 - 1000 - 100 = 50.
    // Computed independently, in the same exact decimal engine the
    // implementation uses, so this proves decimal-exact behavior rather
    // than merely approximating a JavaScript-float expectation.
    const denominator = new FinancialDecimal(1000).plus(
      new FinancialDecimal(100).times(new FinancialDecimal(20).dividedBy(30)),
    );
    const expected = new FinancialDecimal(50).dividedBy(denominator);
    expect(result.returnRate.toFixed(30)).toBe(expected.toFixed(30));
  });

  it("since-inception case: zero beginning value, a day-one contribution carries full weight", () => {
    const result = calculateModifiedDietz(
      "2026-01-01",
      "2026-01-31",
      Money.zero(),
      Money.fromDecimal("1100"),
      [{ date: "2026-01-01", amount: Money.fromDecimal("1000") }],
    );

    expect(result.status).toBe("available");
    if (result.status !== "available") throw new Error("unreachable");
    // denominator = 0 + 1000*(30/30) = 1000; numerator = 1100 - 0 - 1000 = 100
    expect(result.returnRate.toFixed(10)).toBe("0.1000000000");
  });

  it("a withdrawal is a negative external flow", () => {
    const result = calculateModifiedDietz(
      "2026-01-01",
      "2026-01-31",
      Money.fromDecimal("1000"),
      Money.fromDecimal("900"),
      [{ date: "2026-01-01", amount: Money.fromDecimal("-100") }],
    );

    expect(result.status).toBe("available");
    if (result.status !== "available") throw new Error("unreachable");
    // denominator = 1000 + (-100)*1 = 900; numerator = 900 - 1000 - (-100) = 0
    expect(result.returnRate.toFixed(10)).toBe("0.0000000000");
  });

  it("is unavailable when either valuation is missing, never zero", () => {
    const result = calculateModifiedDietz("2026-01-01", "2026-01-31", null, Money.fromDecimal("1100"), []);

    expect(result.status).toBe("unavailable");
    if (result.status !== "unavailable") throw new Error("unreachable");
    expect(result.reason).toMatch(/missing/i);
  });

  it("is unavailable when the denominator is zero or negative", () => {
    const result = calculateModifiedDietz(
      "2026-01-01",
      "2026-01-31",
      Money.zero(),
      Money.fromDecimal("500"),
      [{ date: "2026-01-31", amount: Money.fromDecimal("-1000") }],
    );

    expect(result.status).toBe("unavailable");
    if (result.status !== "unavailable") throw new Error("unreachable");
    expect(result.reason).toMatch(/zero or negative/i);
  });

  it("a zero-length period treats every flow as fully invested", () => {
    const result = calculateModifiedDietz(
      "2026-01-01",
      "2026-01-01",
      Money.zero(),
      Money.fromDecimal("1050"),
      [{ date: "2026-01-01", amount: Money.fromDecimal("1000") }],
    );

    expect(result.status).toBe("available");
    if (result.status !== "available") throw new Error("unreachable");
    expect(result.returnRate.toFixed(10)).toBe("0.0500000000");
  });

  it("repeated calculation with identical inputs is reproducible", () => {
    const args = [
      "2026-01-01",
      "2026-01-31",
      Money.fromDecimal("1000"),
      Money.fromDecimal("1150"),
      [{ date: "2026-01-11", amount: Money.fromDecimal("100") }],
    ] as const;

    const first = calculateModifiedDietz(...args);
    const second = calculateModifiedDietz(...args);

    expect(first).toEqual(second);
  });
});
