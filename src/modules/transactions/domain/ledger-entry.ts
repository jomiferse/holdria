import { ValidationError } from "@/shared/domain/errors";
import { DateOnly } from "@/shared/domain/date-only";
import { Money } from "@/shared/domain/money";
import { Quantity } from "@/shared/domain/quantity";
import type { UserId } from "@/shared/domain/user-id";

/**
 * The `portfolios` and `instruments` tables already enforce ownership at
 * the database level (see their schemas), but the `portfolio` and
 * `instruments` modules that would own branded identifier types are not
 * implemented yet (tasks 4.1/5.1). These stay plain `string` aliases so
 * this module has no premature dependency on either; replace with a
 * branded type re-exported from those modules once they exist.
 */
export type PortfolioId = string;
export type InstrumentId = string;
export type LedgerEntryId = string;
/** Links the CONTRIBUTION and BUY written by one atomic contribute-and-invest command. */
export type LedgerGroupId = string;

export type LedgerEntryType = "CONTRIBUTION" | "WITHDRAWAL" | "BUY" | "SELL";

/** Fields every ledger entry carries regardless of type. */
interface LedgerEntryIdentity {
  /** `undefined` for an entry not yet persisted. */
  readonly id: LedgerEntryId | undefined;
  readonly ownerId: UserId;
  readonly portfolioId: PortfolioId;
  readonly effectiveDate: DateOnly;
  /** Assigned by persistence; `undefined` for an entry not yet persisted. */
  readonly sequence: bigint | undefined;
  readonly groupId: LedgerGroupId | undefined;
  readonly note: string | undefined;
}

export interface ContributionEntry extends LedgerEntryIdentity {
  readonly type: "CONTRIBUTION";
  readonly cashAmount: Money;
}

export interface WithdrawalEntry extends LedgerEntryIdentity {
  readonly type: "WITHDRAWAL";
  readonly cashAmount: Money;
}

export interface BuyEntry extends LedgerEntryIdentity {
  readonly type: "BUY";
  readonly instrumentId: InstrumentId;
  readonly quantity: Quantity;
  readonly unitPrice: Money;
  /** Always present; zero when the owner specified none. */
  readonly fee: Money;
}

export interface SellEntry extends LedgerEntryIdentity {
  readonly type: "SELL";
  readonly instrumentId: InstrumentId;
  readonly quantity: Quantity;
  readonly unitPrice: Money;
  /** Always present; zero when the owner specified none. */
  readonly fee: Money;
}

/** A cash or trade movement in a portfolio's ledger (see design.md decision 6). */
export type LedgerEntry = ContributionEntry | WithdrawalEntry | BuyEntry | SellEntry;

/** Common construction fields shared by every entry type's constructor input. */
interface LedgerEntryInputBase {
  readonly id?: LedgerEntryId;
  readonly portfolioId: PortfolioId;
  readonly effectiveDate: string;
  readonly sequence?: bigint;
  readonly groupId?: LedgerGroupId;
  readonly note?: string;
}

export interface CashEntryInput extends LedgerEntryInputBase {
  readonly cashAmount: string | number;
}

export interface TradeEntryInput extends LedgerEntryInputBase {
  readonly instrumentId: InstrumentId;
  readonly quantity: string | number;
  readonly unitPrice: string | number;
  readonly fee?: string | number;
}

function buildIdentity(ownerId: UserId, input: LedgerEntryInputBase): LedgerEntryIdentity {
  return {
    id: input.id,
    ownerId,
    portfolioId: input.portfolioId,
    effectiveDate: DateOnly.parse(input.effectiveDate, "effectiveDate"),
    sequence: input.sequence,
    groupId: input.groupId,
    note: input.note,
  };
}

/** Validates and constructs a CONTRIBUTION entry (increases cash). */
export function createContribution(ownerId: UserId, input: CashEntryInput): ContributionEntry {
  return {
    ...buildIdentity(ownerId, input),
    type: "CONTRIBUTION",
    cashAmount: Money.fromInput(input.cashAmount, "cashAmount"),
  };
}

/** Validates and constructs a WITHDRAWAL entry (decreases cash). */
export function createWithdrawal(ownerId: UserId, input: CashEntryInput): WithdrawalEntry {
  return {
    ...buildIdentity(ownerId, input),
    type: "WITHDRAWAL",
    cashAmount: Money.fromInput(input.cashAmount, "cashAmount"),
  };
}

/** Validates and constructs a BUY entry (increases units, decreases cash by cost plus fee). */
export function createBuy(ownerId: UserId, input: TradeEntryInput): BuyEntry {
  return {
    ...buildIdentity(ownerId, input),
    type: "BUY",
    instrumentId: input.instrumentId,
    quantity: Quantity.fromInput(input.quantity, "quantity"),
    unitPrice: Money.fromInput(input.unitPrice, "unitPrice"),
    fee: Money.fromNonNegativeInput(input.fee ?? 0, "fee"),
  };
}

/** Validates and constructs a SELL entry (decreases units, increases cash by proceeds minus fee). */
export function createSell(ownerId: UserId, input: TradeEntryInput): SellEntry {
  return {
    ...buildIdentity(ownerId, input),
    type: "SELL",
    instrumentId: input.instrumentId,
    quantity: Quantity.fromInput(input.quantity, "quantity"),
    unitPrice: Money.fromInput(input.unitPrice, "unitPrice"),
    fee: Money.fromNonNegativeInput(input.fee ?? 0, "fee"),
  };
}

/**
 * Untyped shape of a ledger entry as it arrives from a boundary that has
 * not yet narrowed it by `type` (e.g. a generic "add entry" form, or a
 * persisted row read back for replay). Every field beyond `type`,
 * `portfolioId`, and `effectiveDate` is optional so this type alone
 * cannot express "this is definitely a BUY" — `parseLedgerEntry` is what
 * turns it into one of the four checked entry types, or rejects it.
 */
export interface RawLedgerEntryInput {
  readonly type: string;
  readonly id?: LedgerEntryId;
  readonly portfolioId: PortfolioId;
  readonly effectiveDate: string;
  readonly sequence?: bigint;
  readonly groupId?: LedgerGroupId;
  readonly note?: string;
  readonly instrumentId?: InstrumentId | null;
  readonly cashAmount?: string | number | null;
  readonly quantity?: string | number | null;
  readonly unitPrice?: string | number | null;
  readonly fee?: string | number | null;
}

const CASH_FIELDS_ON_TRADE_ENTRY = ["cashAmount"] as const;
const TRADE_FIELDS_ON_CASH_ENTRY = ["instrumentId", "quantity", "unitPrice"] as const;

/**
 * Validates a raw, not-yet-discriminated entry against both ledger spec
 * requirements that a single TypeScript union cannot enforce at the
 * boundary where `type` itself is still just a string: "Type-specific
 * entry validation" (a cash entry must not carry trade fields, a trade
 * entry must carry all of its required fields) and, by delegating to the
 * per-type constructors, every field-level invariant (positive
 * magnitudes, non-negative fee, valid date).
 *
 * Throws one `ValidationError` whose `fieldErrors` names every offending
 * or missing field, never just the first one, so a caller can render all
 * problems at once.
 */
export function parseLedgerEntry(ownerId: UserId, raw: RawLedgerEntryInput): LedgerEntry {
  switch (raw.type) {
    case "CONTRIBUTION":
    case "WITHDRAWAL": {
      const fieldErrors = fieldsPresentErrors(raw, TRADE_FIELDS_ON_CASH_ENTRY);
      if (raw.cashAmount === undefined || raw.cashAmount === null) {
        (fieldErrors.cashAmount ??= []).push("Required");
      }
      if (Object.keys(fieldErrors).length > 0) {
        throw new ValidationError(
          `${raw.type} entries must carry only a cash amount`,
          fieldErrors,
        );
      }
      const input: CashEntryInput = {
        id: raw.id,
        portfolioId: raw.portfolioId,
        effectiveDate: raw.effectiveDate,
        sequence: raw.sequence,
        groupId: raw.groupId,
        note: raw.note,
        cashAmount: raw.cashAmount as string | number,
      };
      return raw.type === "CONTRIBUTION"
        ? createContribution(ownerId, input)
        : createWithdrawal(ownerId, input);
    }
    case "BUY":
    case "SELL": {
      const fieldErrors = fieldsPresentErrors(raw, CASH_FIELDS_ON_TRADE_ENTRY);
      for (const field of ["instrumentId", "quantity", "unitPrice"] as const) {
        const value = raw[field];
        if (value === undefined || value === null || value === "") {
          (fieldErrors[field] ??= []).push("Required");
        }
      }
      if (Object.keys(fieldErrors).length > 0) {
        throw new ValidationError(`${raw.type} entries require instrument, quantity, and unit price`, fieldErrors);
      }
      const input: TradeEntryInput = {
        id: raw.id,
        portfolioId: raw.portfolioId,
        effectiveDate: raw.effectiveDate,
        sequence: raw.sequence,
        groupId: raw.groupId,
        note: raw.note,
        instrumentId: raw.instrumentId as InstrumentId,
        quantity: raw.quantity as string | number,
        unitPrice: raw.unitPrice as string | number,
        fee: raw.fee ?? undefined,
      };
      return raw.type === "BUY" ? createBuy(ownerId, input) : createSell(ownerId, input);
    }
    default:
      throw new ValidationError(`Unsupported ledger entry type: ${raw.type}`, {
        type: ["Must be one of CONTRIBUTION, WITHDRAWAL, BUY, SELL"],
      });
  }
}

function fieldsPresentErrors(
  raw: RawLedgerEntryInput,
  fields: readonly (keyof RawLedgerEntryInput)[],
): Record<string, string[]> {
  const errors: Record<string, string[]> = {};
  for (const field of fields) {
    const value = raw[field];
    if (value !== undefined && value !== null) {
      errors[field] = [`Must not be set on a ${raw.type} entry`];
    }
  }
  return errors;
}
