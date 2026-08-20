import { describe, expect, it } from "vitest";

import { ValidationError } from "@/shared/domain/errors";

import { DateOnly } from "./date-only";

describe("DateOnly", () => {
  it("parses a valid YYYY-MM-DD date", () => {
    expect(DateOnly.parse("2026-08-20").toString()).toBe("2026-08-20");
  });

  it("rejects malformed shapes", () => {
    expect(() => DateOnly.parse("20-08-2026")).toThrow(ValidationError);
    expect(() => DateOnly.parse("2026/08/20")).toThrow(ValidationError);
    expect(() => DateOnly.parse("2026-08-20T00:00:00Z")).toThrow(ValidationError);
  });

  it("rejects impossible calendar dates", () => {
    expect(() => DateOnly.parse("2026-02-30")).toThrow(ValidationError);
    expect(() => DateOnly.parse("2026-13-01")).toThrow(ValidationError);
  });

  it("accepts a leap day on a leap year", () => {
    expect(DateOnly.parse("2024-02-29").toString()).toBe("2024-02-29");
  });

  it("orders dates chronologically", () => {
    const earlier = DateOnly.parse("2026-01-01");
    const later = DateOnly.parse("2026-01-02");
    expect(earlier.compareTo(later)).toBe(-1);
    expect(later.compareTo(earlier)).toBe(1);
    expect(earlier.compareTo(earlier)).toBe(0);
  });

  it("compares equality by calendar value", () => {
    expect(DateOnly.parse("2026-01-01").equals(DateOnly.fromPersisted("2026-01-01"))).toBe(true);
  });
});
