import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";

import { db } from "@/db/client";
import { createTestUser, deleteTestUser } from "@/db/test-utils";
import { portfolios } from "@/modules/portfolio/infrastructure/schema";
import { ledgerEntries } from "@/modules/transactions/infrastructure/schema";
import type { UserId } from "@/shared/domain/user-id";
import { toInstrumentId } from "../domain/instrument";
import { DuplicateIsinError, InstrumentReferencedError } from "../domain/errors";
import { DrizzleInstrumentRepository } from "./drizzle-instrument-repository";

/**
 * Exercises the repository against a real PostgreSQL database, including
 * the constraints only the database enforces: per-owner ISIN uniqueness
 * and foreign-key protection against deleting a referenced instrument.
 */
const hasDatabase = Boolean(process.env.DATABASE_URL);
const maybeDescribe = hasDatabase ? describe : describe.skip;

maybeDescribe("DrizzleInstrumentRepository", () => {
  const repository = new DrizzleInstrumentRepository();
  let owner: UserId;
  let stranger: UserId;

  beforeEach(async () => {
    owner = await createTestUser();
    stranger = await createTestUser();
  });

  afterEach(async () => {
    await deleteTestUser(owner);
    await deleteTestUser(stranger);
  });

  it("creates and lists only the owner's own instruments", async () => {
    await repository.create(owner, { type: "STOCK", name: "Apple", isin: null, ticker: "AAPL", market: "NASDAQ" });
    await repository.create(stranger, { type: "STOCK", name: "Someone else's", isin: null, ticker: null, market: null });

    const rows = await repository.listOwned(owner);
    expect(rows).toHaveLength(1);
    expect(rows[0].name).toBe("Apple");
  });

  it("does not find another user's instrument by id", async () => {
    const created = await repository.create(owner, { type: "STOCK", name: "Apple", isin: null, ticker: "AAPL", market: null });
    expect(await repository.findOwnedById(stranger, created.id)).toBeNull();
  });

  it("enforces required ISIN for FUND at the database layer", async () => {
    await expect(
      repository.create(owner, { type: "FUND", name: "No ISIN Fund", isin: null, ticker: null, market: null }),
    ).rejects.toThrow();
  });

  it("rejects a duplicate ISIN for the same owner and points at the existing instrument", async () => {
    const first = await repository.create(owner, {
      type: "FUND",
      name: "World Fund",
      isin: "IE00B4L5Y983",
      ticker: null,
      market: null,
    });

    await expect(
      repository.create(owner, { type: "FUND", name: "Duplicate", isin: "IE00B4L5Y983", ticker: null, market: null }),
    ).rejects.toMatchObject(new DuplicateIsinError(first.id));
  });

  it("allows two different owners to use the same ISIN", async () => {
    await repository.create(owner, { type: "FUND", name: "World Fund", isin: "IE00B4L5Y983", ticker: null, market: null });
    const second = await repository.create(stranger, {
      type: "FUND",
      name: "World Fund",
      isin: "IE00B4L5Y983",
      ticker: null,
      market: null,
    });
    expect(second.isin).toBe("IE00B4L5Y983");
  });

  it("does not treat ticker as globally unique", async () => {
    await repository.create(owner, { type: "STOCK", name: "Apple", isin: null, ticker: "AAPL", market: null });
    const second = await repository.create(stranger, {
      type: "STOCK",
      name: "Apple Inc",
      isin: null,
      ticker: "AAPL",
      market: null,
    });
    expect(second.ticker).toBe("AAPL");
  });

  it("deletes an unreferenced instrument", async () => {
    const created = await repository.create(owner, { type: "STOCK", name: "Apple", isin: null, ticker: "AAPL", market: null });
    expect(await repository.delete(owner, created.id)).toBe(true);
  });

  it("does not delete another user's instrument", async () => {
    const created = await repository.create(owner, { type: "STOCK", name: "Apple", isin: null, ticker: "AAPL", market: null });
    expect(await repository.delete(stranger, created.id)).toBe(false);
  });

  it("protects an instrument referenced by a ledger entry", async () => {
    const created = await repository.create(owner, { type: "STOCK", name: "Apple", isin: null, ticker: "AAPL", market: null });

    const [portfolio] = await db.insert(portfolios).values({ ownerId: owner, name: "Test portfolio" }).returning();
    await db.insert(ledgerEntries).values({
      ownerId: owner,
      portfolioId: portfolio.id,
      instrumentId: created.id,
      entryType: "BUY",
      effectiveDate: "2024-01-01",
      quantity: "1",
      unitPrice: "100",
      fee: "0",
    });

    await expect(repository.delete(owner, created.id)).rejects.toThrow(InstrumentReferencedError);

    // Clean up the ledger entry so the instrument (and its FK-referencing
    // portfolio row) can be dropped by the user cascade in afterEach.
    await db.delete(ledgerEntries).where(eq(ledgerEntries.instrumentId, toInstrumentId(created.id)));
  });
});
