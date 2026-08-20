import { InvariantViolationError } from "@/shared/domain/errors";
import { Money } from "@/shared/domain/money";
import { Quantity } from "@/shared/domain/quantity";

import type { InstrumentId, LedgerEntry } from "./ledger-entry";

/** The open position in one instrument after replaying the ledger up to some point. */
export interface PositionState {
  readonly instrumentId: InstrumentId;
  readonly units: Quantity;
  /**
   * Total cost basis of the currently open units, including purchase
   * fees (design.md decision 7: "Weighted-average cost includes purchase
   * fees"). The average cost per unit is `openCost / units`, computed on
   * demand rather than stored, so it never drifts from its inputs.
   */
  readonly openCost: Money;
  /** Cumulative realized result (proceeds net of sale fee minus cost removed) from every SELL of this instrument so far. */
  readonly realizedResult: Money;
}

/** Portfolio state after replaying an ordered ledger. */
export interface LedgerProjection {
  readonly cash: Money;
  readonly positions: ReadonlyMap<InstrumentId, PositionState>;
  /** Sum of every position's realized result. */
  readonly realizedResult: Money;
}

function emptyProjection(): LedgerProjection {
  return { cash: Money.zero(), positions: new Map(), realizedResult: Money.zero() };
}

function emptyPosition(instrumentId: InstrumentId): PositionState {
  return { instrumentId, units: Quantity.zero(), openCost: Money.zero(), realizedResult: Money.zero() };
}

/**
 * Orders entries the one way the ledger spec allows: `(effective_date,
 * sequence)` (see "Deterministic entry order"). Every entry passed to
 * `reduceLedger` must already carry a `sequence` — for a not-yet-persisted
 * entry, the caller (the transactions persistence layer, task 6.4) is
 * responsible for assigning a real or provisional one before replay, since
 * only persistence knows where a new or edited entry falls relative to the
 * portfolio's existing rows.
 */
function sortedByEffectiveOrder(entries: readonly LedgerEntry[]): LedgerEntry[] {
  return [...entries].sort((a, b) => {
    const dateComparison = a.effectiveDate.compareTo(b.effectiveDate);
    if (dateComparison !== 0) return dateComparison;
    if (a.sequence === undefined || b.sequence === undefined) {
      throw new Error(
        "reduceLedger requires every entry to have a defined sequence; assign one before replay.",
      );
    }
    if (a.sequence < b.sequence) return -1;
    if (a.sequence > b.sequence) return 1;
    return 0;
  });
}

function describeEntry(entry: LedgerEntry): string {
  const instrument = entry.type === "BUY" || entry.type === "SELL" ? ` of ${entry.instrumentId}` : "";
  return `${entry.type}${instrument} on ${entry.effectiveDate.toString()} (sequence ${entry.sequence ?? "pending"})`;
}

function applyEntry(projection: LedgerProjection, entry: LedgerEntry): LedgerProjection {
  switch (entry.type) {
    case "CONTRIBUTION":
      return { ...projection, cash: projection.cash.plus(entry.cashAmount) };

    case "WITHDRAWAL": {
      const cash = projection.cash.minus(entry.cashAmount);
      if (cash.isNegative()) {
        throw new InvariantViolationError(
          `${describeEntry(entry)} would leave portfolio cash negative`,
        );
      }
      return { ...projection, cash };
    }

    case "BUY": {
      const cost = entry.unitPrice.times(entry.quantity.value).plus(entry.fee);
      const cash = projection.cash.minus(cost);
      if (cash.isNegative()) {
        throw new InvariantViolationError(
          `${describeEntry(entry)} would leave portfolio cash negative`,
        );
      }
      const previous = projection.positions.get(entry.instrumentId) ?? emptyPosition(entry.instrumentId);
      const position: PositionState = {
        ...previous,
        units: previous.units.plus(entry.quantity),
        openCost: previous.openCost.plus(cost),
      };
      const positions = new Map(projection.positions);
      positions.set(entry.instrumentId, position);
      return { ...projection, cash, positions };
    }

    case "SELL": {
      const previous = projection.positions.get(entry.instrumentId) ?? emptyPosition(entry.instrumentId);
      const remainingUnits = previous.units.minus(entry.quantity);
      if (remainingUnits.isNegative()) {
        throw new InvariantViolationError(
          `${describeEntry(entry)} would leave held units negative`,
        );
      }
      // Removing the entire remaining position uses its exact open cost
      // rather than `averageCost * quantity`, so a full sell always zeroes
      // openCost exactly instead of leaving decimal division residue.
      const costRemoved = remainingUnits.isZero()
        ? previous.openCost
        : previous.openCost.dividedBy(previous.units.value).times(entry.quantity.value);
      const proceeds = entry.unitPrice.times(entry.quantity.value).minus(entry.fee);
      const realizedResult = proceeds.minus(costRemoved);
      const position: PositionState = {
        ...previous,
        units: remainingUnits,
        openCost: previous.openCost.minus(costRemoved),
        realizedResult: previous.realizedResult.plus(realizedResult),
      };
      const positions = new Map(projection.positions);
      positions.set(entry.instrumentId, position);
      const cash = projection.cash.plus(proceeds);
      if (cash.isNegative()) {
        // Unreachable given positive proceeds and a non-negative fee, kept
        // as a defensive invariant check rather than an assumption.
        throw new InvariantViolationError(
          `${describeEntry(entry)} would leave portfolio cash negative`,
        );
      }
      return {
        cash,
        positions,
        realizedResult: projection.realizedResult.plus(realizedResult),
      };
    }
  }
}

/**
 * Pure, deterministic replay of one portfolio's ledger entries into cash,
 * per-instrument positions (units, weighted-average open cost, realized
 * result), and total realized result.
 *
 * Entries are always processed in `(effective_date, sequence)` order
 * regardless of the order they are passed in (see "Deterministic entry
 * order"). Throws `InvariantViolationError` the moment any prefix of the
 * ordered ledger would produce negative cash or negative instrument units
 * (see "Ledger invariants"), so a caller validating a mutation can run the
 * full portfolio replay and catch one error rather than re-deriving where
 * it failed.
 */
export function reduceLedger(entries: readonly LedgerEntry[]): LedgerProjection {
  const ordered = sortedByEffectiveOrder(entries);
  return ordered.reduce(applyEntry, emptyProjection());
}
