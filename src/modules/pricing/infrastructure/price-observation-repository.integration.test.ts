/**
 * PostgreSQL integration tests for `priceObservationRepository`.
 *
 * Requires a running, migrated database reachable via `DATABASE_URL` (see
 * `docker-compose.yml`'s `postgres` service and `drizzle/roles.sql`).
 * There is no shared integration-test harness yet (openspec task 1.5), so
 * this file seeds and tears down its own `user` and `instruments` rows
 * directly against the schema rather than depending on unimplemented
 * identity/instruments application fixtures.
 */
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { db } from "@/db/client";
import { user } from "@/db/schema/auth-schema";
import { instruments } from "@/modules/instruments/infrastructure/schema";
import {
  DuplicatePriceObservationError,
} from "@/modules/pricing/domain/errors";
import { toInstrumentId, toPriceObservationId } from "@/modules/pricing/domain/price-observation";
import { priceObservationRepository } from "@/modules/pricing/infrastructure/price-observation-repository";
import { NotFoundError } from "@/shared/domain/errors";
import { toUserId } from "@/shared/domain/user-id";

const ownerAId = crypto.randomUUID();
const ownerBId = crypto.randomUUID();
let instrumentAId: string;
let instrumentBId: string;

beforeAll(async () => {
  await db.insert(user).values([
    { id: ownerAId, name: "Owner A", email: `owner-a-${ownerAId}@example.test`, emailVerified: true },
    { id: ownerBId, name: "Owner B", email: `owner-b-${ownerBId}@example.test`, emailVerified: true },
  ]);

  const [instrumentA] = await db
    .insert(instruments)
    .values({ ownerId: ownerAId, type: "STOCK", name: "Owner A Stock", ticker: "AAA", market: "XNYS" })
    .returning({ id: instruments.id });
  instrumentAId = instrumentA.id;

  const [instrumentB] = await db
    .insert(instruments)
    .values({ ownerId: ownerBId, type: "STOCK", name: "Owner B Stock", ticker: "BBB", market: "XNYS" })
    .returning({ id: instruments.id });
  instrumentBId = instrumentB.id;
});

afterAll(async () => {
  // Cascades remove instruments and price_observations owned by these users.
  await db.delete(user).where(eq(user.id, ownerAId));
  await db.delete(user).where(eq(user.id, ownerBId));
});

describe("priceObservationRepository", () => {
  it("records value, effective date, source, and provenance", async () => {
    const created = await priceObservationRepository.create({
      ownerId: toUserId(ownerAId),
      instrumentId: toInstrumentId(instrumentAId),
      price: "101.50",
      currency: "EUR",
      effectiveDate: "2026-08-01",
    });

    expect(created.price.toString()).toBe("101.5");
    expect(created.effectiveDate).toBe("2026-08-01");
    expect(created.source).toBe("MANUAL");
    expect(created.ingestedAt).toBeInstanceOf(Date);
  });

  it("prevents a second observation for the same instrument and date", async () => {
    await priceObservationRepository.create({
      ownerId: toUserId(ownerAId),
      instrumentId: toInstrumentId(instrumentAId),
      price: "50",
      currency: "EUR",
      effectiveDate: "2026-08-02",
    });

    await expect(
      priceObservationRepository.create({
        ownerId: toUserId(ownerAId),
        instrumentId: toInstrumentId(instrumentAId),
        price: "55",
        currency: "EUR",
        effectiveDate: "2026-08-02",
      }),
    ).rejects.toThrow(DuplicatePriceObservationError);
  });

  it("rejects creating a price for another owner's instrument", async () => {
    await expect(
      priceObservationRepository.create({
        ownerId: toUserId(ownerAId),
        instrumentId: toInstrumentId(instrumentBId),
        price: "10",
        currency: "EUR",
        effectiveDate: "2026-08-03",
      }),
    ).rejects.toThrow(NotFoundError);
  });

  it("edits an existing observation and preserves it for subsequent reads", async () => {
    const created = await priceObservationRepository.create({
      ownerId: toUserId(ownerAId),
      instrumentId: toInstrumentId(instrumentAId),
      price: "20",
      currency: "EUR",
      effectiveDate: "2026-08-04",
    });

    const edited = await priceObservationRepository.update(toUserId(ownerAId), created.id, {
      price: "21.75",
      effectiveDate: "2026-08-04",
    });

    expect(edited.price.toString()).toBe("21.75");

    const reread = await priceObservationRepository.findOwnedById(toUserId(ownerAId), created.id);
    expect(reread?.price.toString()).toBe("21.75");
  });

  it("does not let one owner edit or delete another owner's observation", async () => {
    const created = await priceObservationRepository.create({
      ownerId: toUserId(ownerAId),
      instrumentId: toInstrumentId(instrumentAId),
      price: "30",
      currency: "EUR",
      effectiveDate: "2026-08-05",
    });

    await expect(
      priceObservationRepository.update(toUserId(ownerBId), created.id, { price: "99", effectiveDate: "2026-08-05" }),
    ).rejects.toThrow(NotFoundError);
    await expect(priceObservationRepository.delete(toUserId(ownerBId), created.id)).rejects.toThrow(NotFoundError);

    const stillThere = await priceObservationRepository.findOwnedById(toUserId(ownerAId), created.id);
    expect(stillThere?.price.toString()).toBe("30");
  });

  it("deletes an owned observation", async () => {
    const created = await priceObservationRepository.create({
      ownerId: toUserId(ownerAId),
      instrumentId: toInstrumentId(instrumentAId),
      price: "40",
      currency: "EUR",
      effectiveDate: "2026-08-06",
    });

    await priceObservationRepository.delete(toUserId(ownerAId), created.id);

    const reread = await priceObservationRepository.findOwnedById(toUserId(ownerAId), created.id);
    expect(reread).toBeNull();
  });

  it("throws NotFoundError deleting an observation that does not exist", async () => {
    await expect(
      priceObservationRepository.delete(toUserId(ownerAId), toPriceObservationId(crypto.randomUUID())),
    ).rejects.toThrow(NotFoundError);
  });

  it("selects the latest eligible observation on or before the as-of date", async () => {
    await priceObservationRepository.create({
      ownerId: toUserId(ownerAId),
      instrumentId: toInstrumentId(instrumentAId),
      price: "60",
      currency: "EUR",
      effectiveDate: "2026-08-10",
    });
    await priceObservationRepository.create({
      ownerId: toUserId(ownerAId),
      instrumentId: toInstrumentId(instrumentAId),
      price: "65",
      currency: "EUR",
      effectiveDate: "2026-08-12",
    });

    const exact = await priceObservationRepository.findLatestAsOf(
      toUserId(ownerAId),
      toInstrumentId(instrumentAId),
      "2026-08-12",
    );
    expect(exact?.price.toString()).toBe("65");
    expect(exact?.effectiveDate).toBe("2026-08-12");

    const carriedForward = await priceObservationRepository.findLatestAsOf(
      toUserId(ownerAId),
      toInstrumentId(instrumentAId),
      "2026-08-20",
    );
    expect(carriedForward?.price.toString()).toBe("65");
    expect(carriedForward?.effectiveDate).toBe("2026-08-12");

    // Before every date any other test in this file records for
    // `instrumentAId`, so this assertion holds regardless of test order.
    const unpriced = await priceObservationRepository.findLatestAsOf(
      toUserId(ownerAId),
      toInstrumentId(instrumentAId),
      "2026-01-01",
    );
    expect(unpriced).toBeNull();
  });

  it("never selects another owner's observation as-of", async () => {
    await priceObservationRepository.create({
      ownerId: toUserId(ownerBId),
      instrumentId: toInstrumentId(instrumentBId),
      price: "999",
      currency: "EUR",
      effectiveDate: "2026-08-15",
    });

    const result = await priceObservationRepository.findLatestAsOf(
      toUserId(ownerAId),
      toInstrumentId(instrumentBId),
      "2026-08-20",
    );

    expect(result).toBeNull();
  });
});
