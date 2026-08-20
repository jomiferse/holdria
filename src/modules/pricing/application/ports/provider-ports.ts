/**
 * Provider-neutral ports for future automated pricing (design.md decision
 * 9). No adapter implements these in this change — see the pricing spec's
 * "provider-neutral pricing boundary" scope. Each port's DTOs are shaped
 * for Holdria's domain, not for any specific provider's response format;
 * a real adapter is responsible for translating its own API's payloads
 * into these DTOs before anything reaches application or domain code. A
 * provider payload type must never appear in these signatures, nor in
 * `pricing`, `instruments`, `transactions`, `portfolio`, or `analytics`
 * domain/application code.
 */

/** A candidate instrument a provider returned for an instrument search. */
export interface InstrumentSearchCandidate {
  readonly provider: string;
  readonly externalId: string;
  readonly name: string;
  readonly isin?: string;
  readonly ticker?: string;
  readonly market?: string;
  readonly currency: string;
}

/**
 * A single dated price point from a provider, as a decimal string —
 * callers convert it to a `Decimal` (never a JavaScript `number`) at the
 * application boundary, the same way manual price input is validated.
 */
export interface ProviderPricePoint {
  readonly value: string;
  readonly currency: string;
  /** Date-only, `YYYY-MM-DD`. */
  readonly effectiveDate: string;
}

/** Looks up instrument candidates by free-text query (e.g. name, ISIN, ticker). */
export interface InstrumentSearchPort {
  search(query: string): Promise<InstrumentSearchCandidate[]>;
}

/** Retrieves the most recent price a provider has for one of its instrument identifiers. */
export interface LatestPricePort {
  getLatestPrice(externalId: string): Promise<ProviderPricePoint | null>;
}

/** Retrieves a provider's dated price history for one of its instrument identifiers over an inclusive date range. */
export interface PriceHistoryPort {
  getPriceHistory(externalId: string, from: string, to: string): Promise<ProviderPricePoint[]>;
}
