import { describe, expect, it } from "vitest";

import { ValidationError } from "@/shared/domain/errors";

import { formatEur, Money } from "./money";

describe("Money", () => {
  it("accepts a positive amount from trusted input", () => {
    const money = Money.fromInput("1234.5", "amount");
    expect(money.toPersistedString()).toBe("1234.5");
  });

  it("rejects zero and negative amounts", () => {
    expect(() => Money.fromInput("0", "amount")).toThrow(ValidationError);
    expect(() => Money.fromInput("-1", "amount")).toThrow(ValidationError);
  });

  it("rejects non-numeric input", () => {
    expect(() => Money.fromInput("abc", "amount")).toThrow(ValidationError);
    expect(() => Money.fromInput("", "amount")).toThrow(ValidationError);
  });

  it("allows zero for non-negative input (fees)", () => {
    expect(() => Money.fromNonNegativeInput("0", "fee")).not.toThrow();
    expect(() => Money.fromNonNegativeInput("-0.01", "fee")).toThrow(ValidationError);
  });

  it("adds and subtracts with exact decimal precision", () => {
    const a = Money.fromDecimal("0.1");
    const b = Money.fromDecimal("0.2");
    expect(a.plus(b).toPersistedString()).toBe("0.3");
  });

  it("refuses to combine different currencies", () => {
    const eur = Money.fromDecimal("1", "EUR");
    // @ts-expect-error - only EUR exists today; simulate a future currency at runtime.
    const other = Money.fromDecimal("1", "USD");
    expect(() => eur.plus(other)).toThrow();
  });

  it("compares amounts without floating-point drift", () => {
    const a = Money.fromDecimal("100.10");
    const b = Money.fromDecimal("100.1");
    expect(a.compareTo(b)).toBe(0);
  });

  // Finding: "Precision policy" — `fromInput` rejects a value the
  // `numeric(20, 8)` column cannot store exactly, instead of persisting a
  // silently rounded amount.
  it("rejects an amount with more decimal places than the supported precision", () => {
    expect(() => Money.fromInput("1.123456789", "amount")).toThrow(ValidationError);
  });

  it("rejects an amount with more integer digits than the supported precision", () => {
    expect(() => Money.fromInput("1000000000000", "amount")).toThrow(ValidationError);
  });

  it("accepts an amount at exactly the supported precision boundary", () => {
    expect(() => Money.fromInput("999999999999.12345678", "amount")).not.toThrow();
  });
});

describe("formatEur", () => {
  // de-DE currency formatting separates the amount and symbol with a
  // no-break space (U+00A0), not a regular space, so build expectations
  // from the platform's own Intl output rather than a pasted literal.
  const nbspFormat = (amount: string) =>
    new Intl.NumberFormat("de-DE", {
      style: "currency",
      currency: "EUR",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(Number(amount));

  it("formats a decimal amount with EUR symbol and two decimals", () => {
    expect(formatEur(Money.fromDecimal("1234.5"))).toBe(nbspFormat("1234.5"));
  });

  it("formats zero", () => {
    expect(formatEur(Money.zero())).toBe(nbspFormat("0"));
  });
});
