import { describe, expect, it } from "vitest";

import { hasValidIsinChecksum, hasValidIsinFormat, normalizeAndValidateIsin, normalizeIsin } from "./isin";
import { ValidationError } from "@/shared/domain/errors";

// US0378331005 is Apple Inc.'s real, published ISIN — used here only as a
// known-good checksum fixture, not a live pricing dependency.
const APPLE_ISIN = "US0378331005";

describe("normalizeIsin", () => {
  it("uppercases and strips internal whitespace", () => {
    expect(normalizeIsin("us 037833 1005")).toBe(APPLE_ISIN);
  });
});

describe("hasValidIsinFormat", () => {
  it("accepts the canonical two-letter-prefix, 12-character shape", () => {
    expect(hasValidIsinFormat(APPLE_ISIN)).toBe(true);
  });

  it("rejects the wrong length", () => {
    expect(hasValidIsinFormat("US037833100")).toBe(false);
  });

  it("rejects a lowercase or unnormalized value", () => {
    expect(hasValidIsinFormat("us0378331005")).toBe(false);
  });
});

describe("hasValidIsinChecksum", () => {
  it("validates a real ISIN's Luhn check digit", () => {
    expect(hasValidIsinChecksum(APPLE_ISIN)).toBe(true);
  });

  it("rejects a mutated check digit", () => {
    expect(hasValidIsinChecksum("US0378331006")).toBe(false);
  });
});

describe("normalizeAndValidateIsin", () => {
  it("normalizes lowercase/spaced input to canonical uppercase form", () => {
    expect(normalizeAndValidateIsin("us 037833 1005")).toBe(APPLE_ISIN);
  });

  it("throws ValidationError for an invalid ISIN", () => {
    expect(() => normalizeAndValidateIsin("not-an-isin")).toThrow(ValidationError);
  });

  it("throws ValidationError for a well-formed but checksum-invalid ISIN", () => {
    expect(() => normalizeAndValidateIsin("US0378331006")).toThrow(ValidationError);
  });
});
