import { ConflictError } from "@/shared/domain/errors";
import type { InstrumentId } from "./instrument";

/**
 * Raised when an owner already has an instrument with the submitted ISIN.
 * Carries the existing instrument's id so the UI can link the user to it
 * instead of only reporting the rejection (see "User repeats an owned
 * ISIN" in the instrument-management spec).
 */
export class DuplicateIsinError extends ConflictError {
  constructor(readonly existingInstrumentId: InstrumentId) {
    super("You already have an instrument with this ISIN.");
  }
}

/**
 * Raised when deleting an instrument that a ledger entry or price
 * observation still references.
 */
export class InstrumentReferencedError extends ConflictError {
  constructor() {
    super("This instrument is used by an operation or price and cannot be deleted.");
  }
}
