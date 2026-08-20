import type { LedgerEntryValues } from "../infrastructure/ledger-repository";
import type { LedgerEntry } from "../domain/ledger-entry";

/** Converts a validated domain entry into the string/null column shape `numeric` and `date` columns expect. */
export function toLedgerEntryValues(entry: LedgerEntry): LedgerEntryValues {
  const shared = {
    portfolioId: entry.portfolioId,
    entryType: entry.type,
    effectiveDate: entry.effectiveDate.toString(),
    groupId: entry.groupId ?? null,
    note: entry.note ?? null,
  };
  if (entry.type === "CONTRIBUTION" || entry.type === "WITHDRAWAL") {
    return {
      ...shared,
      instrumentId: null,
      cashAmount: entry.cashAmount.toPersistedString(),
      quantity: null,
      unitPrice: null,
      fee: null,
    };
  }
  return {
    ...shared,
    instrumentId: entry.instrumentId,
    cashAmount: null,
    quantity: entry.quantity.toPersistedString(),
    unitPrice: entry.unitPrice.toPersistedString(),
    fee: entry.fee.toPersistedString(),
  };
}
