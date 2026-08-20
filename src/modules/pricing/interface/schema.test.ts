import { describe, expect, it } from "vitest";

import {
  createPriceObservationSchema,
  deletePriceObservationSchema,
  editPriceObservationSchema,
} from "@/modules/pricing/interface/schema";

const instrumentId = "11111111-1111-4111-8111-111111111111";
const observationId = "22222222-2222-4222-8222-222222222222";

describe("createPriceObservationSchema", () => {
  it("accepts a well-formed submission", () => {
    const result = createPriceObservationSchema.safeParse({
      instrumentId,
      price: "12.34",
      effectiveDate: "2026-08-20",
    });
    expect(result.success).toBe(true);
  });

  it("rejects a missing instrument, blank price, and malformed date together", () => {
    const result = createPriceObservationSchema.safeParse({
      instrumentId: "not-a-uuid",
      price: "",
      effectiveDate: "20/08/2026",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const fieldErrors = result.error.flatten().fieldErrors;
      expect(fieldErrors.instrumentId).toBeDefined();
      expect(fieldErrors.price).toBeDefined();
      expect(fieldErrors.effectiveDate).toBeDefined();
    }
  });
});

describe("editPriceObservationSchema", () => {
  it("accepts a well-formed correction", () => {
    const result = editPriceObservationSchema.safeParse({
      id: observationId,
      price: "5.00",
      effectiveDate: "2026-08-01",
    });
    expect(result.success).toBe(true);
  });
});

describe("deletePriceObservationSchema", () => {
  it("requires a valid id", () => {
    expect(deletePriceObservationSchema.safeParse({ id: observationId }).success).toBe(true);
    expect(deletePriceObservationSchema.safeParse({ id: "nope" }).success).toBe(false);
  });
});
