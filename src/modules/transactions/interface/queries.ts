import { drizzleInstrumentRepository } from "@/modules/instruments/infrastructure/drizzle-instrument-repository";
import type { UserId } from "@/shared/domain/user-id";

import { listLedgerEntries } from "../application/ledger-commands";
import type { LedgerEntry, LedgerEntryType, PortfolioId } from "../domain/ledger-entry";

/** Minimal instrument fields the ledger UI needs for its instrument picker and to label BUY/SELL rows. */
export interface LedgerInstrumentOption {
  readonly id: string;
  readonly name: string;
  readonly type: string;
}

/**
 * Plain, serializable view of one ledger entry for the operations UI.
 *
 * `LedgerEntry` carries `Money`/`Quantity`/`DateOnly` class instances,
 * which the Server->Client Component boundary cannot serialize ("Only
 * plain objects, and a few built-ins ... can be passed to Client
 * Components from Server Components"). This DTO exists so the Server
 * Component page can pass an entry into the client-side `LedgerForm`
 * (for editing) without crossing that boundary with a class instance;
 * every field is a plain string or primitive.
 */
export interface LedgerEntryView {
  readonly id: string;
  readonly type: LedgerEntryType;
  readonly effectiveDate: string;
  readonly note: string;
  readonly instrumentId: string;
  readonly cashAmount: string;
  readonly quantity: string;
  readonly unitPrice: string;
  readonly fee: string;
}

function toLedgerEntryView(entry: LedgerEntry): LedgerEntryView {
  const isTrade = entry.type === "BUY" || entry.type === "SELL";
  return {
    id: entry.id ?? "",
    type: entry.type,
    effectiveDate: entry.effectiveDate.toString(),
    note: entry.note ?? "",
    instrumentId: isTrade ? entry.instrumentId : "",
    cashAmount: entry.type === "CONTRIBUTION" || entry.type === "WITHDRAWAL" ? entry.cashAmount.amount.toFixed() : "",
    quantity: isTrade ? entry.quantity.value.toFixed() : "",
    unitPrice: isTrade ? entry.unitPrice.amount.toFixed() : "",
    fee: isTrade ? entry.fee.amount.toFixed() : "",
  };
}

export interface OperationsPageData {
  readonly entries: LedgerEntryView[];
  readonly instruments: LedgerInstrumentOption[];
}

/** Server Component read model for the portfolio operations page: the ledger and the owner's instruments for the picker. */
export async function getOperationsPageData(ownerId: UserId, portfolioId: string): Promise<OperationsPageData> {
  const [entries, instruments] = await Promise.all([
    listLedgerEntries(ownerId, portfolioId as PortfolioId),
    drizzleInstrumentRepository.listOwned(ownerId),
  ]);

  return {
    entries: entries.map(toLedgerEntryView),
    instruments: instruments.map((instrument) => ({ id: instrument.id, name: instrument.name, type: instrument.type })),
  };
}
