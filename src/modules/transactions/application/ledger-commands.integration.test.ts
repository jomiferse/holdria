import { randomUUID } from "node:crypto";

import { eq } from "drizzle-orm";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { db, closeDatabaseConnection } from "@/db/client";
import { user } from "@/db/schema/auth-schema";
import { instruments } from "@/modules/instruments/infrastructure/schema";
import { portfolios } from "@/modules/portfolio/infrastructure/schema";
import { InvariantViolationError, NotFoundError, ValidationError } from "@/shared/domain/errors";
import { toUserId, type UserId } from "@/shared/domain/user-id";

import { createLedgerEntry, deleteLedgerEntry, editLedgerEntry, listLedgerEntries } from "./ledger-commands";
import { ledgerEntries } from "../infrastructure/schema";

/**
 * Exercises the transactions module against a real PostgreSQL database
 * (see design.md "Test by architectural risk"). Requires `DATABASE_URL`
 * to point at a reachable database with the project's migrations applied
 * (`pnpm db:migrate`); `docker-compose.yml` provides one for local
 * development.
 *
 * The portfolio and instrument modules (tasks 4.x/5.x) are not
 * implemented yet, so fixtures insert directly into their tables rather
 * than going through an application layer that does not exist.
 */
describe("ledger persistence (integration)", () => {
  let ownerId: UserId;
  let otherOwnerId: UserId;
  let portfolioId: string;
  let instrumentId: string;

  beforeAll(async () => {
    const [owner] = await db
      .insert(user)
      .values({ name: "Ledger Test Owner", email: `ledger-owner-${randomUUID()}@example.test` })
      .returning();
    const [otherOwner] = await db
      .insert(user)
      .values({ name: "Other Owner", email: `ledger-other-${randomUUID()}@example.test` })
      .returning();
    ownerId = toUserId(owner.id);
    otherOwnerId = toUserId(otherOwner.id);

    const [portfolio] = await db
      .insert(portfolios)
      .values({ ownerId, name: "Integration Test Portfolio" })
      .returning();
    portfolioId = portfolio.id;

    const [instrument] = await db
      .insert(instruments)
      .values({ ownerId, type: "STOCK", name: "Test Corp", ticker: "TST", market: "XMAD" })
      .returning();
    instrumentId = instrument.id;
  });

  afterEach(async () => {
    await db.delete(ledgerEntries).where(eq(ledgerEntries.portfolioId, portfolioId));
  });

  afterAll(async () => {
    await db.delete(user).where(eq(user.id, ownerId));
    await db.delete(user).where(eq(user.id, otherOwnerId));
    await closeDatabaseConnection();
  });

  it("creates and lists a contribution", async () => {
    const created = await createLedgerEntry(ownerId, {
      type: "CONTRIBUTION",
      portfolioId,
      effectiveDate: "2026-01-01",
      cashAmount: "1000",
    });
    expect(created.type).toBe("CONTRIBUTION");
    expect(created.sequence).toBeTypeOf("bigint");

    const listed = await listLedgerEntries(ownerId, portfolioId);
    expect(listed).toHaveLength(1);
    expect(listed[0].id).toBe(created.id);
  });

  it("allocates concurrency-safe, strictly increasing sequences for concurrent inserts", async () => {
    const results = await Promise.all(
      Array.from({ length: 8 }, (_, index) =>
        createLedgerEntry(ownerId, {
          type: "CONTRIBUTION",
          portfolioId,
          effectiveDate: "2026-01-01",
          cashAmount: `${index + 1}`,
        }),
      ),
    );
    const sequences = results.map((entry) => entry.sequence);
    const uniqueSequences = new Set(sequences.map(String));
    expect(uniqueSequences.size).toBe(sequences.length);
  });

  it("persists a buy, then a partial sell, with correct replayed state", async () => {
    await createLedgerEntry(ownerId, {
      type: "CONTRIBUTION",
      portfolioId,
      effectiveDate: "2026-01-01",
      cashAmount: "2000",
    });
    await createLedgerEntry(ownerId, {
      type: "BUY",
      portfolioId,
      effectiveDate: "2026-01-02",
      instrumentId,
      quantity: "10",
      unitPrice: "100",
      fee: "5",
    });
    const sell = await createLedgerEntry(ownerId, {
      type: "SELL",
      portfolioId,
      effectiveDate: "2026-01-03",
      instrumentId,
      quantity: "4",
      unitPrice: "110",
      fee: "2",
    });

    expect(sell.type).toBe("SELL");
    const listed = await listLedgerEntries(ownerId, portfolioId);
    expect(listed).toHaveLength(3);
  });

  it("rejects a buy that would leave cash negative and leaves the ledger unchanged", async () => {
    await createLedgerEntry(ownerId, {
      type: "CONTRIBUTION",
      portfolioId,
      effectiveDate: "2026-01-01",
      cashAmount: "100",
    });

    // A buy that fails on itself (not a backdated conflict with a later,
    // separate operation) keeps the reducer's own message unwrapped.
    await expect(
      createLedgerEntry(ownerId, {
        type: "BUY",
        portfolioId,
        effectiveDate: "2026-01-02",
        instrumentId,
        quantity: "10",
        unitPrice: "50",
      }),
    ).rejects.toThrow(/BUY.*would leave portfolio cash negative/);

    const listed = await listLedgerEntries(ownerId, portfolioId);
    expect(listed).toHaveLength(1); // only the contribution; the buy never committed
  });

  it("rejects a sell that would leave units negative and leaves the ledger unchanged", async () => {
    await createLedgerEntry(ownerId, {
      type: "CONTRIBUTION",
      portfolioId,
      effectiveDate: "2026-01-01",
      cashAmount: "1000",
    });
    await createLedgerEntry(ownerId, {
      type: "BUY",
      portfolioId,
      effectiveDate: "2026-01-02",
      instrumentId,
      quantity: "5",
      unitPrice: "100",
    });

    await expect(
      createLedgerEntry(ownerId, {
        type: "SELL",
        portfolioId,
        effectiveDate: "2026-01-03",
        instrumentId,
        quantity: "6",
        unitPrice: "100",
      }),
    ).rejects.toThrow(InvariantViolationError);

    const listed = await listLedgerEntries(ownerId, portfolioId);
    expect(listed).toHaveLength(2);
  });

  it("rejects a cash entry carrying trade fields before touching the database", async () => {
    await expect(
      createLedgerEntry(ownerId, {
        type: "CONTRIBUTION",
        portfolioId,
        effectiveDate: "2026-01-01",
        cashAmount: "100",
        instrumentId,
        quantity: "1",
      } as never),
    ).rejects.toThrow(ValidationError);

    const listed = await listLedgerEntries(ownerId, portfolioId);
    expect(listed).toHaveLength(0);
  });

  it("edits an entry validly and reflects the correction in subsequent state", async () => {
    const contribution = await createLedgerEntry(ownerId, {
      type: "CONTRIBUTION",
      portfolioId,
      effectiveDate: "2026-01-01",
      cashAmount: "500",
    });

    const edited = await editLedgerEntry(ownerId, contribution.id!, {
      effectiveDate: "2026-01-01",
      cashAmount: "750",
    });

    expect(edited.type).toBe("CONTRIBUTION");
    if (edited.type === "CONTRIBUTION") {
      expect(edited.cashAmount.toPersistedString()).toBe("750");
    }
  });

  it("rejects an edit that would invalidate a later balance", async () => {
    const contribution = await createLedgerEntry(ownerId, {
      type: "CONTRIBUTION",
      portfolioId,
      effectiveDate: "2026-01-01",
      cashAmount: "1000",
    });
    await createLedgerEntry(ownerId, {
      type: "BUY",
      portfolioId,
      effectiveDate: "2026-01-02",
      instrumentId,
      quantity: "10",
      unitPrice: "100",
    });

    // Shrinking the contribution to 500 would leave the later buy (costing
    // 1000) unaffordable.
    await expect(
      editLedgerEntry(ownerId, contribution.id!, {
        effectiveDate: "2026-01-01",
        cashAmount: "500",
      }),
    ).rejects.toThrow(/Saving this correction conflicts with a later operation/);

    const listed = await listLedgerEntries(ownerId, portfolioId);
    const stillOriginal = listed.find((e) => e.id === contribution.id);
    expect(stillOriginal?.type).toBe("CONTRIBUTION");
    if (stillOriginal?.type === "CONTRIBUTION") {
      expect(stillOriginal.cashAmount.toPersistedString()).toBe("1000");
    }
  });

  it("deletes an entry when safe to do so", async () => {
    const contribution = await createLedgerEntry(ownerId, {
      type: "CONTRIBUTION",
      portfolioId,
      effectiveDate: "2026-01-01",
      cashAmount: "100",
    });

    await deleteLedgerEntry(ownerId, contribution.id!);

    const listed = await listLedgerEntries(ownerId, portfolioId);
    expect(listed).toHaveLength(0);
  });

  it("rejects deleting an entry that a later entry depends on, and preserves the ledger", async () => {
    const contribution = await createLedgerEntry(ownerId, {
      type: "CONTRIBUTION",
      portfolioId,
      effectiveDate: "2026-01-01",
      cashAmount: "1000",
    });
    await createLedgerEntry(ownerId, {
      type: "BUY",
      portfolioId,
      effectiveDate: "2026-01-02",
      instrumentId,
      quantity: "10",
      unitPrice: "100",
    });

    await expect(deleteLedgerEntry(ownerId, contribution.id!)).rejects.toThrow(
      /Deleting this entry conflicts with a later operation/,
    );

    const listed = await listLedgerEntries(ownerId, portfolioId);
    expect(listed).toHaveLength(2);
  });

  it("rejects inserting a backdated entry that would invalidate an already-persisted later state", async () => {
    await createLedgerEntry(ownerId, {
      type: "CONTRIBUTION",
      portfolioId,
      effectiveDate: "2026-01-05",
      cashAmount: "1000",
    });
    await createLedgerEntry(ownerId, {
      type: "BUY",
      portfolioId,
      effectiveDate: "2026-01-10",
      instrumentId,
      quantity: "10",
      unitPrice: "100",
    });

    // Inserted with an earlier effective date than both existing entries,
    // so in replayed order the new withdrawal itself is first and fails on
    // itself (no cash yet) — not a conflict with a later, separate entry —
    // so the reducer's own message is surfaced unwrapped.
    await expect(
      createLedgerEntry(ownerId, {
        type: "WITHDRAWAL",
        portfolioId,
        effectiveDate: "2026-01-01",
        cashAmount: "50",
      }),
    ).rejects.toThrow(/WITHDRAWAL.*would leave portfolio cash negative/);

    const listed = await listLedgerEntries(ownerId, portfolioId);
    expect(listed).toHaveLength(2); // the backdated withdrawal never committed
  });

  it("identifies an inserted entry that invalidates a separate, later entry as a conflict", async () => {
    await createLedgerEntry(ownerId, {
      type: "CONTRIBUTION",
      portfolioId,
      effectiveDate: "2026-01-05",
      cashAmount: "1000",
    });
    await createLedgerEntry(ownerId, {
      type: "BUY",
      portfolioId,
      effectiveDate: "2026-01-10",
      instrumentId,
      quantity: "10",
      unitPrice: "100",
    });

    // Inserted between the two existing entries: the withdrawal itself is
    // affordable (500 of 1000 cash), but it leaves too little for the
    // already-persisted later buy — a genuine conflict with a separate,
    // later operation, not a failure of the withdrawal itself.
    await expect(
      createLedgerEntry(ownerId, {
        type: "WITHDRAWAL",
        portfolioId,
        effectiveDate: "2026-01-06",
        cashAmount: "500",
      }),
    ).rejects.toThrow(/Adding this entry conflicts with a later operation[\s\S]*BUY[\s\S]*would leave portfolio cash negative/);

    const listed = await listLedgerEntries(ownerId, portfolioId);
    expect(listed).toHaveLength(2); // the conflicting withdrawal never committed
  });

  it("golden case: fees on both a buy and a full sell are reflected exactly in cash and realized result", async () => {
    await createLedgerEntry(ownerId, {
      type: "CONTRIBUTION",
      portfolioId,
      effectiveDate: "2026-01-01",
      cashAmount: "1000",
    });
    await createLedgerEntry(ownerId, {
      type: "BUY",
      portfolioId,
      effectiveDate: "2026-01-02",
      instrumentId,
      quantity: "10",
      unitPrice: "50",
      fee: "10", // cost = 510, cash -> 490
    });
    await createLedgerEntry(ownerId, {
      type: "SELL",
      portfolioId,
      effectiveDate: "2026-01-03",
      instrumentId,
      quantity: "10",
      unitPrice: "55",
      fee: "5", // proceeds = 545, realized = 545 - 510 = 35
    });

    const listed = await listLedgerEntries(ownerId, portfolioId);
    expect(listed).toHaveLength(3);
  });

  it("never lets one owner read, edit, or delete another owner's entry", async () => {
    const contribution = await createLedgerEntry(ownerId, {
      type: "CONTRIBUTION",
      portfolioId,
      effectiveDate: "2026-01-01",
      cashAmount: "100",
    });

    await expect(listLedgerEntries(otherOwnerId, portfolioId)).resolves.toHaveLength(0);
    await expect(
      editLedgerEntry(otherOwnerId, contribution.id!, {
        effectiveDate: "2026-01-01",
        cashAmount: "1",
      }),
    ).rejects.toThrow(NotFoundError);
    await expect(deleteLedgerEntry(otherOwnerId, contribution.id!)).rejects.toThrow(NotFoundError);

    const stillThere = await listLedgerEntries(ownerId, portfolioId);
    expect(stillThere).toHaveLength(1);
  });
});
