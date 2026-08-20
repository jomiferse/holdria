import { describe, expect, it } from "vitest";

import { ValidationError } from "@/shared/domain/errors";

import { Quantity } from "./quantity";

describe("Quantity", () => {
  it("accepts a positive quantity from trusted input", () => {
    expect(Quantity.fromInput("10.5", "quantity").toPersistedString()).toBe("10.5");
  });

  it("rejects zero and negative quantities", () => {
    expect(() => Quantity.fromInput("0", "quantity")).toThrow(ValidationError);
    expect(() => Quantity.fromInput("-1", "quantity")).toThrow(ValidationError);
  });

  // Finding: "Precision policy" — `Quantity` shares `Money`'s
  // `parseFinancialInput`, so it is bound by the same `numeric(20, 8)`
  // policy (see `shared/domain/decimal.ts`).
  it("rejects a quantity with more decimal places than the supported precision", () => {
    expect(() => Quantity.fromInput("1.123456789", "quantity")).toThrow(ValidationError);
  });

  it("rejects a quantity with more integer digits than the supported precision", () => {
    expect(() => Quantity.fromInput("1000000000000", "quantity")).toThrow(ValidationError);
  });

  it("accepts a quantity at exactly the supported precision boundary", () => {
    expect(() => Quantity.fromInput("999999999999.12345678", "quantity")).not.toThrow();
  });
});
