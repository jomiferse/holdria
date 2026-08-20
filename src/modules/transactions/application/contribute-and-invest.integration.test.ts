import { randomUUID } from "node:crypto";

import { eq } from "drizzle-orm";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { db, closeDatabaseConnection } from "@/db/client";
import { user } from "@/db/schema/auth-schema";
import { instruments } from "@/modules/instruments/infrastructure/schema";
import { portfolios } from "@/modules/portfolio/infrastructure/schema";
import { InvariantViolationError, ValidationError } from "@/shared/domain/errors";
import { toUserId, type UserId } from "@/shared/domain/user-id";

import { contributeAndInvest } from "./contribute-and-invest";
import { listLedgerEntries } from "./ledger-commands";
import { ledgerEntries } from "../infrastructure/schema";

describe("contributeAndInvest (integration)", () => {
  let ownerId: UserId;
  let portfolioId: string;
  let instrumentId: string;

  beforeAll(async () => {
    const [owner] = await db
      .insert(user)
      .values({ name: "Contribute Invest Owner", email: `contribute-invest-${randomUUID()}@example.test` })
      .returning();
    ownerId = toUserId(owner.id);

    const [portfolio] = await db
      .insert(portfolios)
      .values({ ownerId, name: "Contribute Invest Portfolio" })
      .returning();
    portfolioId = portfolio.id;

    const [instrument] = await db
      .insert(instruments)
      .values({ ownerId, type: "STOCK", name: "Test Corp", ticker: "TST2", market: "XMAD" })
      .returning();
    instrumentId = instrument.id;
  });

  afterEach(async () => {
    await db.delete(ledgerEntries).where(eq(ledgerEntries.portfolioId, portfolioId));
  });

  afterAll(async () => {
    await db.delete(user).where(eq(user.id, ownerId));
    await closeDatabaseConnection();
  });

  it("commits both entries, linked and ordered with the contribution before the buy", async () => {
    const result = await contributeAndInvest(ownerId, {
      portfolioId,
      effectiveDate: "2026-01-01",
      cashAmount: "1000",
      instrumentId,
      quantity: "5",
      unitPrice: "100",
      fee: "2",
    });

    expect(result.contribution.groupId).toBe(result.buy.groupId);
    expect(result.contribution.sequence!).toBeLessThan(result.buy.sequence!);

    const listed = await listLedgerEntries(ownerId, portfolioId);
    expect(listed).toHaveLength(2);
    expect(listed[0].type).toBe("CONTRIBUTION");
    expect(listed[1].type).toBe("BUY");
  });

  it("rolls back both entries when the buy would exceed the contributed cash", async () => {
    await expect(
      contributeAndInvest(ownerId, {
        portfolioId,
        effectiveDate: "2026-01-01",
        cashAmount: "100",
        instrumentId,
        quantity: "10",
        unitPrice: "50", // costs 500, only 100 contributed
      }),
    ).rejects.toThrow(InvariantViolationError);

    const listed = await listLedgerEntries(ownerId, portfolioId);
    expect(listed).toHaveLength(0);
  });

  it("rejects and persists nothing when the buy input itself is invalid", async () => {
    await expect(
      contributeAndInvest(ownerId, {
        portfolioId,
        effectiveDate: "2026-01-01",
        cashAmount: "1000",
        instrumentId,
        quantity: "-1",
        unitPrice: "50",
      }),
    ).rejects.toThrow(ValidationError);

    const listed = await listLedgerEntries(ownerId, portfolioId);
    expect(listed).toHaveLength(0);
  });

  it("leaves any pre-existing ledger state untouched by a failed combined workflow", async () => {
    await contributeAndInvest(ownerId, {
      portfolioId,
      effectiveDate: "2026-01-01",
      cashAmount: "1000",
      instrumentId,
      quantity: "1",
      unitPrice: "10",
    });

    await expect(
      contributeAndInvest(ownerId, {
        portfolioId,
        effectiveDate: "2026-01-02",
        cashAmount: "1",
        instrumentId,
        quantity: "100",
        unitPrice: "100",
      }),
    ).rejects.toThrow(InvariantViolationError);

    const listed = await listLedgerEntries(ownerId, portfolioId);
    expect(listed).toHaveLength(2); // only the first, successful group
  });

  it("serializes two concurrent contribute-and-invest calls on the same portfolio without corrupting the ledger", async () => {
    // Each call funds its own buy, so this is not an overspend race, but it
    // proves contribute-and-invest takes the same per-portfolio lock as
    // create/edit/delete (see `lockOwnedPortfolioForUpdate`): both groups
    // commit fully, each contribution stays ordered before its own buy, and
    // no sequence is duplicated or interleaved incorrectly under
    // concurrency.
    const [first, second] = await Promise.all([
      contributeAndInvest(ownerId, {
        portfolioId,
        effectiveDate: "2026-01-01",
        cashAmount: "1000",
        instrumentId,
        quantity: "5",
        unitPrice: "100",
      }),
      contributeAndInvest(ownerId, {
        portfolioId,
        effectiveDate: "2026-01-01",
        cashAmount: "500",
        instrumentId,
        quantity: "2",
        unitPrice: "100",
      }),
    ]);

    expect(first.contribution.sequence!).toBeLessThan(first.buy.sequence!);
    expect(second.contribution.sequence!).toBeLessThan(second.buy.sequence!);

    const listed = await listLedgerEntries(ownerId, portfolioId);
    expect(listed).toHaveLength(4);
    const sequences = listed.map((e) => String(e.sequence));
    expect(new Set(sequences).size).toBe(4);
  });
});
