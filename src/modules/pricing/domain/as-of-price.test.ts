import { Decimal } from "decimal.js";
import { describe, expect, it } from "vitest";

import { selectAsOfPrice } from "@/modules/pricing/domain/as-of-price";
import {
  toInstrumentId,
  toPriceObservationId,
  type PriceObservation,
} from "@/modules/pricing/domain/price-observation";
import { toUserId } from "@/shared/domain/user-id";

const instrumentId = toInstrumentId("11111111-1111-1111-1111-111111111111");
const ownerId = toUserId("22222222-2222-2222-2222-222222222222");

function observation(effectiveDate: string, price: string): PriceObservation {
  return {
    id: toPriceObservationId(`obs-${effectiveDate}`),
    ownerId,
    instrumentId,
    price: new Decimal(price),
    currency: "EUR",
    effectiveDate,
    source: "MANUAL",
    ingestedAt: new Date("2026-01-01T00:00:00Z"),
    createdAt: new Date("2026-01-01T00:00:00Z"),
    updatedAt: new Date("2026-01-01T00:00:00Z"),
  };
}

describe("selectAsOfPrice", () => {
  it("selects the observation on the exact requested date", () => {
    const candidates = [observation("2026-08-01", "10"), observation("2026-08-15", "11")];

    const result = selectAsOfPrice(instrumentId, "2026-08-15", candidates);

    expect(result).toMatchObject({ status: "priced", effectiveDate: "2026-08-15" });
    if (result.status === "priced") {
      expect(result.price.toString()).toBe("11");
    }
  });

  it("carries forward the latest earlier observation and preserves its actual date", () => {
    const candidates = [observation("2026-08-01", "10"), observation("2026-08-15", "11")];

    const result = selectAsOfPrice(instrumentId, "2026-08-20", candidates);

    expect(result).toMatchObject({ status: "priced", effectiveDate: "2026-08-15" });
  });

  it("ignores observations after the requested date", () => {
    const candidates = [observation("2026-09-01", "12")];

    const result = selectAsOfPrice(instrumentId, "2026-08-20", candidates);

    expect(result.status).toBe("unpriced");
  });

  it("reports unpriced, not zero, when no eligible observation exists", () => {
    const result = selectAsOfPrice(instrumentId, "2026-08-20", []);

    expect(result).toEqual({ status: "unpriced", instrumentId, asOfDate: "2026-08-20" });
  });

  it("is deterministic regardless of candidate order", () => {
    const candidates = [observation("2026-08-15", "11"), observation("2026-08-01", "10")];

    const result = selectAsOfPrice(instrumentId, "2026-08-20", candidates);

    expect(result).toMatchObject({ status: "priced", effectiveDate: "2026-08-15" });
  });
});
