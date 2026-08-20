import { Decimal } from "decimal.js";

import { ValidationError } from "@/shared/domain/errors";
import type { UserId } from "@/shared/domain/user-id";

/**
 * Identifier for an owned, priceable instrument.
 *
 * Branded the same way as `UserId` so pricing code cannot accidentally
 * pass an arbitrary string where an instrument id is expected. The
 * instruments module (module 5) owns instrument identity; this type
 * mirrors the same underlying UUID until that module exports its own
 * branded id, at which point this alias can be replaced without changing
 * pricing's public shapes.
 */
export type InstrumentId = string & { readonly __brand: "InstrumentId" };

export function toInstrumentId(value: string): InstrumentId {
  return value as InstrumentId;
}

/** Identifier for a single price observation row. */
export type PriceObservationId = string & { readonly __brand: "PriceObservationId" };

export function toPriceObservationId(value: string): PriceObservationId {
  return value as PriceObservationId;
}

/**
 * Where a price observation came from. Only `MANUAL` is written by this
 * change; the union stays open so a future automated-provider source can
 * be added without renaming this type. Matches the `price_observations`
 * table's `source` check constraint.
 */
export type PriceSource = "MANUAL";

/** EUR is the only currency this change supports. Kept as a distinct type (not hard-coded everywhere) so a future multi-currency change touches one place. */
export type PriceCurrency = "EUR";

const EFFECTIVE_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** Validates a date-only ISO string (`YYYY-MM-DD`). Financial dates are date-only; see design.md decision 7. */
export function parseEffectiveDate(value: string): string {
  if (!EFFECTIVE_DATE_PATTERN.test(value) || Number.isNaN(Date.parse(`${value}T00:00:00Z`))) {
    throw new ValidationError("Effective date must be a valid date.", {
      effectiveDate: ["Must be a valid date in YYYY-MM-DD format."],
    });
  }
  return value;
}

/** Validates a manual price: a positive, finite decimal amount. Never a JavaScript `number` past this boundary. */
export function parsePriceValue(value: string | number): Decimal {
  let decimal: Decimal;
  try {
    decimal = new Decimal(value);
  } catch {
    throw new ValidationError("Price must be a valid decimal number.", {
      price: ["Must be a valid decimal number."],
    });
  }
  if (!decimal.isFinite() || decimal.lte(0)) {
    throw new ValidationError("Price must be a positive amount.", {
      price: ["Must be greater than zero."],
    });
  }
  return decimal;
}

/** Validates the price observation currency. Only EUR is accepted in this change. */
export function parsePriceCurrency(value: string): PriceCurrency {
  if (value !== "EUR") {
    throw new ValidationError("Only EUR price observations are supported.", {
      currency: ["Must be EUR."],
    });
  }
  return value;
}

/** A dated, provenance-carrying manual price for an owned instrument. */
export interface PriceObservation {
  readonly id: PriceObservationId;
  readonly ownerId: UserId;
  readonly instrumentId: InstrumentId;
  readonly price: Decimal;
  readonly currency: PriceCurrency;
  /** Date-only, `YYYY-MM-DD`. The date the price was true, not when it was recorded. */
  readonly effectiveDate: string;
  readonly source: PriceSource;
  /** When Holdria ingested this observation. Distinct from `effectiveDate`; never presented as "current" or "real-time". */
  readonly ingestedAt: Date;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

/** Input for recording a new manual price observation. */
export interface NewPriceObservationInput {
  readonly ownerId: UserId;
  readonly instrumentId: InstrumentId;
  readonly price: string | number;
  readonly currency: string;
  readonly effectiveDate: string;
}

/** Input for correcting an existing manual price observation's value and/or date. */
export interface PriceObservationEditInput {
  readonly price: string | number;
  readonly effectiveDate: string;
}
