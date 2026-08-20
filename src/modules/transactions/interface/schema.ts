import { z } from "zod";

/**
 * Shape-level validation for the ledger's Server Action input. Presence
 * and basic string format only — every financial invariant (positive
 * magnitudes, non-negative fee, required fields per type, valid date) is
 * re-checked by `parseLedgerEntry` regardless of what passes here, so the
 * rule is never expressed in two conflicting places (mirrors the
 * instruments and pricing modules' interface schemas).
 */
const LEDGER_ENTRY_TYPES = ["CONTRIBUTION", "WITHDRAWAL", "BUY", "SELL"] as const;

const optionalString = z.string().optional().transform((value) => (value === "" ? undefined : value));

const baseFields = {
  portfolioId: z.string().min(1),
  effectiveDate: z.string().min(1, "Effective date is required."),
  instrumentId: optionalString,
  cashAmount: optionalString,
  quantity: optionalString,
  unitPrice: optionalString,
  fee: optionalString,
  note: optionalString,
};

export const createLedgerEntrySchema = z.object({
  type: z.enum(LEDGER_ENTRY_TYPES, { message: "Choose a valid entry type." }),
  ...baseFields,
});

export const editLedgerEntrySchema = z.object({
  id: z.string().min(1),
  ...baseFields,
});

export const deleteLedgerEntrySchema = z.object({
  id: z.string().min(1),
});

export const contributeAndInvestSchema = z.object({
  portfolioId: z.string().min(1),
  effectiveDate: z.string().min(1, "Effective date is required."),
  cashAmount: z.string().min(1, "Contribution amount is required."),
  instrumentId: z.string().min(1, "Select an instrument."),
  quantity: z.string().min(1, "Quantity is required."),
  unitPrice: z.string().min(1, "Unit price is required."),
  fee: optionalString,
  note: optionalString,
});
