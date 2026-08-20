import { and, asc, eq } from "drizzle-orm";

import { db } from "@/db/client";
import { NotFoundError } from "@/shared/domain/errors";
import type { UserId } from "@/shared/domain/user-id";

import { ledgerEntries } from "./schema";
import type { LedgerEntry, LedgerEntryId, PortfolioId, RawLedgerEntryInput } from "../domain/ledger-entry";
import { parseLedgerEntry } from "../domain/ledger-entry";

/**
 * Either the runtime pool-bound `db` or a `db.transaction` callback's `tx`
 * — every function here accepts either so callers can compose several
 * repository calls inside one atomic transaction (see the application
 * layer's create/edit/delete/contribute-and-invest commands).
 */
type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
export type DbExecutor = typeof db | Transaction;

type LedgerEntryRow = typeof ledgerEntries.$inferSelect;

/** Converts a persisted row (numeric columns as strings, per design.md decision 7) into a validated domain entry. */
function toDomainEntry(ownerId: UserId, row: LedgerEntryRow): LedgerEntry {
  const raw: RawLedgerEntryInput = {
    type: row.entryType,
    id: row.id,
    portfolioId: row.portfolioId,
    effectiveDate: row.effectiveDate,
    sequence: row.sequence,
    groupId: row.groupId ?? undefined,
    note: row.note ?? undefined,
    instrumentId: row.instrumentId ?? undefined,
    cashAmount: row.cashAmount ?? undefined,
    quantity: row.quantity ?? undefined,
    unitPrice: row.unitPrice ?? undefined,
    fee: row.fee ?? undefined,
  };
  return parseLedgerEntry(ownerId, raw);
}

/** Every entry in one owner's portfolio, ordered by `(effective_date, sequence)` — the order the ledger spec requires for replay. */
export async function listByPortfolio(
  executor: DbExecutor,
  ownerId: UserId,
  portfolioId: PortfolioId,
): Promise<LedgerEntry[]> {
  const rows = await executor
    .select()
    .from(ledgerEntries)
    .where(and(eq(ledgerEntries.ownerId, ownerId), eq(ledgerEntries.portfolioId, portfolioId)))
    .orderBy(asc(ledgerEntries.effectiveDate), asc(ledgerEntries.sequence));
  return rows.map((row) => toDomainEntry(ownerId, row));
}

/** Looks up one entry scoped to its claimed owner. Never reveals whether the id exists for a different owner (see design.md decision 4). */
export async function findOwnedById(
  executor: DbExecutor,
  ownerId: UserId,
  id: LedgerEntryId,
): Promise<LedgerEntry | undefined> {
  const [row] = await executor
    .select()
    .from(ledgerEntries)
    .where(and(eq(ledgerEntries.ownerId, ownerId), eq(ledgerEntries.id, id)))
    .limit(1);
  return row ? toDomainEntry(ownerId, row) : undefined;
}

/** Same as `findOwnedById`, but throws `NotFoundError` instead of returning `undefined`. */
export async function requireOwnedById(
  executor: DbExecutor,
  ownerId: UserId,
  id: LedgerEntryId,
): Promise<LedgerEntry> {
  const entry = await findOwnedById(executor, ownerId, id);
  if (!entry) {
    throw new NotFoundError("Ledger entry not found");
  }
  return entry;
}

/** Row shape accepted by `insert`/`update`; every value is a persisted-string or null, matching the `numeric`/`date` columns. */
export interface LedgerEntryValues {
  readonly portfolioId: PortfolioId;
  readonly instrumentId: string | null;
  readonly entryType: string;
  readonly effectiveDate: string;
  readonly groupId: string | null;
  readonly cashAmount: string | null;
  readonly quantity: string | null;
  readonly unitPrice: string | null;
  readonly fee: string | null;
  readonly note: string | null;
}

/** Inserts one entry and returns it with its database-assigned id and sequence. `sequence` is a `bigserial` default, so PostgreSQL allocates it atomically — no application-level counter or locking is needed for concurrency safety. */
export async function insert(
  executor: DbExecutor,
  ownerId: UserId,
  values: LedgerEntryValues,
): Promise<LedgerEntry> {
  const [row] = await executor
    .insert(ledgerEntries)
    .values({ ownerId, ...values })
    .returning();
  return toDomainEntry(ownerId, row);
}

/** Updates one owned entry's mutable fields in place; `id`, `ownerId`, `portfolioId`, and `sequence` never change. */
export async function update(
  executor: DbExecutor,
  ownerId: UserId,
  id: LedgerEntryId,
  values: Omit<LedgerEntryValues, "portfolioId">,
): Promise<LedgerEntry> {
  const [row] = await executor
    .update(ledgerEntries)
    .set({ ...values, updatedAt: new Date() })
    .where(and(eq(ledgerEntries.ownerId, ownerId), eq(ledgerEntries.id, id)))
    .returning();
  if (!row) {
    throw new NotFoundError("Ledger entry not found");
  }
  return toDomainEntry(ownerId, row);
}

/** Deletes one owned entry. No-op (not an error) if it does not exist, matching typical idempotent delete semantics; callers that must distinguish "already gone" use `requireOwnedById` first. */
export async function remove(executor: DbExecutor, ownerId: UserId, id: LedgerEntryId): Promise<void> {
  await executor
    .delete(ledgerEntries)
    .where(and(eq(ledgerEntries.ownerId, ownerId), eq(ledgerEntries.id, id)));
}

/**
 * Distinct portfolio ids (owned by `ownerId`) with at least one BUY or SELL
 * entry for `instrumentId` — the portfolios a correction to that
 * instrument's price can affect. Used to invalidate exactly the affected
 * portfolio analytics routes after a price observation is created, edited,
 * or deleted (finding: "Price correction invalidation"), rather than
 * invalidating every portfolio or none at all.
 */
export async function listPortfolioIdsTradingInstrument(
  executor: DbExecutor,
  ownerId: UserId,
  instrumentId: string,
): Promise<PortfolioId[]> {
  const rows = await executor
    .selectDistinct({ portfolioId: ledgerEntries.portfolioId })
    .from(ledgerEntries)
    .where(and(eq(ledgerEntries.ownerId, ownerId), eq(ledgerEntries.instrumentId, instrumentId)));
  return rows.map((row) => row.portfolioId);
}
