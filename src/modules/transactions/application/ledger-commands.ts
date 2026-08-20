import { db } from "@/db/client";
import type { UserId } from "@/shared/domain/user-id";

import {
  insert,
  listByPortfolio,
  remove,
  requireOwnedById,
  update,
} from "../infrastructure/ledger-repository";
import type {
  LedgerEntry,
  LedgerEntryId,
  LedgerGroupId,
  PortfolioId,
  RawLedgerEntryInput,
} from "../domain/ledger-entry";
import { parseLedgerEntry } from "../domain/ledger-entry";
import { reduceLedger } from "../domain/ledger-reducer";
import { toLedgerEntryValues as toValues } from "./ledger-entry-values";

/**
 * Replays every entry currently in `portfolioId` (as visible within the
 * given transaction) and lets `reduceLedger` throw `InvariantViolationError`
 * if any prefix would leave cash or units negative. Called after the
 * mutation under validation has already been applied inside the same
 * transaction, so a thrown error rolls the mutation back with it (see
 * "Ledger invariants" and "Backdated edit invalidates later state").
 */
async function validatePortfolioReplay(
  executor: Parameters<typeof listByPortfolio>[0],
  ownerId: UserId,
  portfolioId: PortfolioId,
): Promise<void> {
  const entries = await listByPortfolio(executor, ownerId, portfolioId);
  reduceLedger(entries);
}

/**
 * Input for creating one standalone ledger entry. `groupId` is
 * intentionally not accepted here — it is only ever set by the atomic
 * contribute-and-invest command (task 6.5), which links exactly one
 * CONTRIBUTION and one BUY.
 */
export type CreateLedgerEntryInput = Omit<RawLedgerEntryInput, "id" | "sequence" | "groupId">;

/**
 * Validates and persists one new ledger entry, then replays the whole
 * portfolio and rolls back if the result would violate a ledger
 * invariant. Domain validation runs before touching the database so
 * malformed input never opens a transaction.
 */
export async function createLedgerEntry(
  ownerId: UserId,
  input: CreateLedgerEntryInput,
): Promise<LedgerEntry> {
  const candidate = parseLedgerEntry(ownerId, input);

  return db.transaction(async (tx) => {
    const created = await insert(tx, ownerId, toValues(candidate));
    await validatePortfolioReplay(tx, ownerId, created.portfolioId);
    return created;
  });
}

/**
 * Input for editing an existing entry. The entry's type and portfolio
 * cannot change through this command — a different type or portfolio is a
 * delete-and-recreate, not an edit, since the ledger spec does not define
 * what "editing" a CONTRIBUTION into a BUY would mean for the group it
 * might belong to.
 */
export type EditLedgerEntryInput = Omit<
  RawLedgerEntryInput,
  "id" | "sequence" | "type" | "portfolioId" | "groupId"
>;

/**
 * Validates and applies a correction to an existing owned entry, then
 * replays the whole portfolio and rolls back if the correction would
 * invalidate any later cash or unit balance (see "User edits an entry
 * validly" / "Backdated edit invalidates later state").
 */
export async function editLedgerEntry(
  ownerId: UserId,
  id: LedgerEntryId,
  input: EditLedgerEntryInput,
): Promise<LedgerEntry> {
  return db.transaction(async (tx) => {
    const existing = await requireOwnedById(tx, ownerId, id);
    const candidate = parseLedgerEntry(ownerId, {
      ...input,
      id: existing.id,
      type: existing.type,
      portfolioId: existing.portfolioId,
      groupId: existing.groupId,
    });
    const updated = await update(tx, ownerId, id, toValues(candidate));
    await validatePortfolioReplay(tx, ownerId, updated.portfolioId);
    return updated;
  });
}

/**
 * Deletes an owned entry, then replays the remaining portfolio and rolls
 * back if removing it would leave a later cash or unit balance negative
 * (see "User deletes a required earlier entry").
 */
export async function deleteLedgerEntry(ownerId: UserId, id: LedgerEntryId): Promise<void> {
  await db.transaction(async (tx) => {
    const existing = await requireOwnedById(tx, ownerId, id);
    await remove(tx, ownerId, id);
    await validatePortfolioReplay(tx, ownerId, existing.portfolioId);
  });
}

/** Lists one owned portfolio's ledger in deterministic replay order. */
export async function listLedgerEntries(ownerId: UserId, portfolioId: PortfolioId): Promise<LedgerEntry[]> {
  return listByPortfolio(db, ownerId, portfolioId);
}

export type { LedgerGroupId };
