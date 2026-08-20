import { Decimal } from "decimal.js";
import { describe, expect, it, vi } from "vitest";

import { getAsOfPrice } from "@/modules/pricing/application/queries/get-as-of-price";
import { toInstrumentId, toPriceObservationId, type PriceObservation } from "@/modules/pricing/domain/price-observation";
import type { PriceObservationRepository } from "@/modules/pricing/domain/price-observation-repository";
import { toUserId } from "@/shared/domain/user-id";

const ownerId = toUserId("22222222-2222-2222-2222-222222222222");
const instrumentId = toInstrumentId("11111111-1111-1111-1111-111111111111");

function fakeRepository(findLatestAsOf: PriceObservationRepository["findLatestAsOf"]): PriceObservationRepository {
  return {
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    findOwnedById: vi.fn(),
    listByInstrument: vi.fn(),
    findLatestAsOf,
  };
}

describe("getAsOfPrice", () => {
  it("returns a priced result with value, date, and source when an observation exists", async () => {
    const observation: PriceObservation = {
      id: toPriceObservationId("obs-1"),
      ownerId,
      instrumentId,
      price: new Decimal("9.5"),
      currency: "EUR",
      effectiveDate: "2026-08-01",
      source: "MANUAL",
      ingestedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const repository = fakeRepository(vi.fn().mockResolvedValue(observation));

    const result = await getAsOfPrice(repository, ownerId, instrumentId, "2026-08-20");

    expect(result).toEqual({
      status: "priced",
      instrumentId,
      price: observation.price,
      effectiveDate: "2026-08-01",
      source: "MANUAL",
    });
  });

  it("returns an explicit unpriced result when no eligible observation exists", async () => {
    const repository = fakeRepository(vi.fn().mockResolvedValue(null));

    const result = await getAsOfPrice(repository, ownerId, instrumentId, "2026-08-20");

    expect(result).toEqual({ status: "unpriced", instrumentId, asOfDate: "2026-08-20" });
  });
});
