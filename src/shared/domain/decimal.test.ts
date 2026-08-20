import { describe, expect, it } from "vitest";

import { ValidationError } from "@/shared/domain/errors";

import {
  assertWithinSupportedPrecision,
  SUPPORTED_NUMERIC_MAX_INTEGER_DIGITS,
  SUPPORTED_NUMERIC_SCALE,
  toDecimal,
} from "./decimal";

/**
 * Finding: "Precision policy" — every stored financial `Decimal` (Money,
 * Quantity, manual prices) is a PostgreSQL `numeric(20, 8)` column.
 * `assertWithinSupportedPrecision` is the single place that policy is
 * enforced before persistence, so values PostgreSQL would otherwise
 * silently round (excess decimal places) or hard-reject with a raw
 * overflow error (excess integer digits) fail cleanly as a
 * `ValidationError` instead.
 */
describe("assertWithinSupportedPrecision", () => {
  it("accepts a value at exactly the supported scale (8 decimal places)", () => {
    expect(() => assertWithinSupportedPrecision(toDecimal("1.12345678"), "amount")).not.toThrow();
  });

  it("rejects a value with one more decimal place than supported, instead of silently rounding it", () => {
    expect(() => assertWithinSupportedPrecision(toDecimal("1.123456789"), "amount")).toThrow(ValidationError);
  });

  it("accepts a value at exactly the supported integer-digit width (12 digits)", () => {
    expect(() => assertWithinSupportedPrecision(toDecimal("999999999999"), "amount")).not.toThrow();
  });

  it("rejects a value with one more integer digit than supported, instead of a raw database overflow", () => {
    expect(() => assertWithinSupportedPrecision(toDecimal("1000000000000"), "amount")).toThrow(ValidationError);
  });

  it("rejects a negative value that exceeds either bound the same as its positive magnitude", () => {
    expect(() => assertWithinSupportedPrecision(toDecimal("-1.123456789"), "amount")).toThrow(ValidationError);
    expect(() => assertWithinSupportedPrecision(toDecimal("-1000000000000"), "amount")).toThrow(ValidationError);
  });

  it("accepts zero and small values", () => {
    expect(() => assertWithinSupportedPrecision(toDecimal("0"), "amount")).not.toThrow();
    expect(() => assertWithinSupportedPrecision(toDecimal("0.00000001"), "amount")).not.toThrow();
  });

  it("names the offending field in the thrown error", () => {
    try {
      assertWithinSupportedPrecision(toDecimal("1.123456789"), "quantity");
      throw new Error("expected assertWithinSupportedPrecision to throw");
    } catch (error) {
      expect(error).toBeInstanceOf(ValidationError);
      const validationError = error as ValidationError;
      expect(validationError.fieldErrors.quantity).toBeDefined();
    }
  });

  it("the exported constants match the numeric(20, 8) columns this policy documents", () => {
    expect(SUPPORTED_NUMERIC_SCALE).toBe(8);
    expect(SUPPORTED_NUMERIC_MAX_INTEGER_DIGITS).toBe(12);
  });
});
