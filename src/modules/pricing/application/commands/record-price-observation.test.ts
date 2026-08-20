import { Decimal } from "decimal.js";
import { describe, expect, it, vi } from "vitest";

import { recordPriceObservation } from "@/modules/pricing/application/commands/record-price-observation";
import { toInstrumentId, toPriceObservationId, type PriceObservation } from "@/modules/pricing/domain/price-observation";
import type { PriceObservationRepository } from "@/modules/pricing/domain/price-observation-repository";
import { ValidationError } from "@/shared/domain/errors";
import { toUserId } from "@/shared/domain/user-id";

const ownerId = toUserId("22222222-2222-2222-2222-222222222222");
const instrumentId = toInstrumentId("11111111-1111-1111-1111-111111111111");

function fakeRepository(overrides: Partial<PriceObservationRepository> = {}): PriceObservationRepository {
  return {
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    findOwnedById: vi.fn(),
    listByInstrument: vi.fn(),
    findLatestAsOf: vi.fn(),
    ...overrides,
  };
}

describe("recordPriceObservation", () => {
  it("rejects an invalid input before touching the repository", async () => {
    const create = vi.fn();
    const repository = fakeRepository({ create });

    await expect(
      recordPriceObservation(repository, {
        ownerId,
        instrumentId,
        price: "-5",
        currency: "EUR",
        effectiveDate: "2026-08-20",
      }),
    ).rejects.toThrow(ValidationError);

    expect(create).not.toHaveBeenCalled();
  });

  it("delegates a valid input to the repository", async () => {
    const stored: PriceObservation = {
      id: toPriceObservationId("obs-1"),
      ownerId,
      instrumentId,
      price: new Decimal("12.5"),
      currency: "EUR",
      effectiveDate: "2026-08-20",
      source: "MANUAL",
      ingestedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const create = vi.fn().mockResolvedValue(stored);
    const repository = fakeRepository({ create });

    const result = await recordPriceObservation(repository, {
      ownerId,
      instrumentId,
      price: "12.5",
      currency: "EUR",
      effectiveDate: "2026-08-20",
    });

    expect(result).toBe(stored);
    expect(create).toHaveBeenCalledOnce();
  });
});
