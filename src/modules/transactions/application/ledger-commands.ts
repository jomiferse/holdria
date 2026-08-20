import { db } from "@/db/client";
import { toPortfolioId } from "@/modules/portfolio/domain/portfolio";
import { lockOwnedPortfolioForUpdate } from "@/modules/portfolio/infrastructure/drizzle-portfolio-repository";
import { InvariantViolationError } from "@/shared/domain/errors";
import type { UserId } from "@/shared/domain/user-id";

import {
  insert,
  listByPortfolio,
  listPortfolioIdsTradingInstrument,
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
 * Identifies the mutated entry for `validatePortfolioReplay`'s backdated-
 * conflict check. Only `sequence` is compared against the reducer's
 * `describeEntry` output — see that function in `ledger-reducer.ts` — so
 * this stays a plain data shape rather than importing the full domain type.
 */
interface MutatedEntryRef {
  readonly sequence: bigint;
}

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
  /**
   * The entry just created, edited, or (for a delete) removed, and a label
   * describing that action. When the reducer's `InvariantViolationError`
   * names a *different* entry than `mutatedEntry` (or `mutatedEntry` is
   * omitted, as it always is for a delete — the removed entry can never
   * appear in the post-deletion replay), the mutation is a backdated
   * conflict: inserting, editing, or removing an earlier entry invalidated
   * a later, otherwise-unrelated operation. The error is re-thrown with
   * that made explicit (ledger spec: "Backdated edit invalidates later
   * state" requires identifying the conflict with subsequent operations,
   * not just naming the later entry as if it were itself invalid).
   */
  conflict?: { readonly label: string; readonly mutatedEntry?: MutatedEntryRef },
): Promise<void> {
  const entries = await listByPortfolio(executor, ownerId, portfolioId);
  try {
    reduceLedger(entries);
  } catch (error) {
    if (conflict && error instanceof InvariantViolationError) {
      const failedOnMutatedEntry =
        conflict.mutatedEntry !== undefined &&
        error.message.includes(`(sequence ${conflict.mutatedEntry.sequence})`);
      if (!failedOnMutatedEntry) {
        throw new InvariantViolationError(
          `${conflict.label} conflicts with a later operation in this portfolio: ${error.message}`,
        );
      }
    }
    throw error;
  }
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
    // Serializes this mutation against every other create/edit/delete/
    // contribute-and-invest on the same portfolio (see
    // `lockOwnedPortfolioForUpdate`): a concurrent mutation blocks here
    // until this transaction commits or rolls back, so two concurrent
    // overspends or oversells cannot both pass replay and commit.
    await lockOwnedPortfolioForUpdate(tx, ownerId, toPortfolioId(candidate.portfolioId));
    const created = await insert(tx, ownerId, toValues(candidate));
    await validatePortfolioReplay(tx, ownerId, created.portfolioId, {
      label: "Adding this entry",
      mutatedEntry: created.sequence !== undefined ? { sequence: created.sequence } : undefined,
    });
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
    // See `createLedgerEntry` — serializes against concurrent mutations of
    // the same portfolio before the update and replay below.
    await lockOwnedPortfolioForUpdate(tx, ownerId, toPortfolioId(existing.portfolioId));
    const candidate = parseLedgerEntry(ownerId, {
      ...input,
      id: existing.id,
      type: existing.type,
      portfolioId: existing.portfolioId,
      groupId: existing.groupId,
    });
    const updated = await update(tx, ownerId, id, toValues(candidate));
    await validatePortfolioReplay(tx, ownerId, updated.portfolioId, {
      label: "Saving this correction",
      mutatedEntry: updated.sequence !== undefined ? { sequence: updated.sequence } : undefined,
    });
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
    // See `createLedgerEntry` — serializes against concurrent mutations of
    // the same portfolio before the delete and replay below.
    await lockOwnedPortfolioForUpdate(tx, ownerId, toPortfolioId(existing.portfolioId));
    await remove(tx, ownerId, id);
    // No `mutatedEntry`: the removed entry can never appear in the
    // post-deletion replay, so any invariant failure here is always a
    // conflict with a later, otherwise-unrelated operation.
    await validatePortfolioReplay(tx, ownerId, existing.portfolioId, { label: "Deleting this entry" });
  });
}

/** Lists one owned portfolio's ledger in deterministic replay order. */
export async function listLedgerEntries(ownerId: UserId, portfolioId: PortfolioId): Promise<LedgerEntry[]> {
  return listByPortfolio(db, ownerId, portfolioId);
}

/** Portfolio ids (owned by `ownerId`) that ever traded `instrumentId` — see `listPortfolioIdsTradingInstrument`. */
export async function listPortfolioIdsForInstrument(ownerId: UserId, instrumentId: string): Promise<PortfolioId[]> {
  return listPortfolioIdsTradingInstrument(db, ownerId, instrumentId);
}

export type { LedgerGroupId };
