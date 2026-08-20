import { EUR, type Currency } from "@/shared/domain/currency";
import { ValidationError } from "@/shared/domain/errors";
import type { UserId } from "@/shared/domain/user-id";
import { normalizeAndValidateIsin } from "./isin";

/** Branded identifier for an instrument row. Opaque outside this module. */
export type InstrumentId = string & { readonly __brand: "InstrumentId" };

export function toInstrumentId(value: string): InstrumentId {
  return value as InstrumentId;
}

export const INSTRUMENT_TYPES = ["FUND", "ETF", "STOCK"] as const;
export type InstrumentType = (typeof INSTRUMENT_TYPES)[number];

export function isSupportedInstrumentType(value: string): value is InstrumentType {
  return (INSTRUMENT_TYPES as readonly string[]).includes(value);
}

/**
 * A user-owned, reusable investment definition. ISIN is first-class and
 * required for FUND; ETF/STOCK instead carry ticker + market, and a
 * ticker alone is never treated as globally unique (see the
 * instrument-management spec).
 */
export interface Instrument {
  readonly id: InstrumentId;
  readonly ownerId: UserId;
  readonly type: InstrumentType;
  readonly name: string;
  readonly isin: string | null;
  readonly ticker: string | null;
  readonly market: string | null;
  readonly currency: Currency;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

const NAME_MAX_LENGTH = 120;
const TICKER_MAX_LENGTH = 20;
const MARKET_MAX_LENGTH = 20;

export function normalizeInstrumentName(raw: string): string {
  const name = raw.trim();

  if (name.length === 0) {
    throw new ValidationError("Instrument name is required.", {
      name: ["Instrument name is required."],
    });
  }

  if (name.length > NAME_MAX_LENGTH) {
    throw new ValidationError(`Instrument name must be ${NAME_MAX_LENGTH} characters or fewer.`, {
      name: [`Must be ${NAME_MAX_LENGTH} characters or fewer.`],
    });
  }

  return name;
}

/** Trims optional free-text identifiers (ticker, market) to `null` when blank. */
function normalizeOptionalCode(raw: string | null | undefined, field: string, maxLength: number): string | null {
  const value = raw?.trim() ?? "";

  if (value.length === 0) {
    return null;
  }

  if (value.length > maxLength) {
    throw new ValidationError(`${field} must be ${maxLength} characters or fewer.`, {
      [field.toLowerCase()]: [`Must be ${maxLength} characters or fewer.`],
    });
  }

  return value.toUpperCase();
}

export interface InstrumentInput {
  type: string;
  name: string;
  isin?: string | null;
  ticker?: string | null;
  market?: string | null;
  currency?: string;
}

export interface NormalizedInstrumentInput {
  type: InstrumentType;
  name: string;
  isin: string | null;
  ticker: string | null;
  market: string | null;
}

/**
 * The single place instrument creation and edit rules are enforced,
 * independent of Server Actions or persistence: supported type, EUR
 * currency, required and validated ISIN for funds, optional but still
 * validated ISIN otherwise, and length-bounded free-text fields.
 */
export function normalizeInstrumentInput(input: InstrumentInput): NormalizedInstrumentInput {
  if (!isSupportedInstrumentType(input.type)) {
    throw new ValidationError("Unsupported instrument type.", {
      type: ["Choose FUND, ETF, or STOCK."],
    });
  }

  if (input.currency !== undefined && input.currency !== EUR) {
    throw new ValidationError("Only EUR is currently supported. FX conversion is not available yet.", {
      currency: ["Only EUR is currently supported."],
    });
  }

  const name = normalizeInstrumentName(input.name);
  const rawIsin = input.isin?.trim() ?? "";

  let isin: string | null = null;
  if (input.type === "FUND") {
    if (rawIsin.length === 0) {
      throw new ValidationError("Funds require a valid ISIN.", {
        isin: ["Funds require a valid ISIN."],
      });
    }
    isin = normalizeAndValidateIsin(rawIsin);
  } else if (rawIsin.length > 0) {
    isin = normalizeAndValidateIsin(rawIsin);
  }

  const ticker = normalizeOptionalCode(input.ticker, "Ticker", TICKER_MAX_LENGTH);
  const market = normalizeOptionalCode(input.market, "Market", MARKET_MAX_LENGTH);

  return { type: input.type, name, isin, ticker, market };
}
