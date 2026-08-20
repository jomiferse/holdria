import { randomUUID } from "node:crypto";

import { db } from "@/db/client";
import type { UserId } from "@/shared/domain/user-id";

import { insert, listByPortfolio } from "../infrastructure/ledger-repository";
import { createBuy, createContribution } from "../domain/ledger-entry";
import type { BuyEntry, ContributionEntry, InstrumentId, PortfolioId } from "../domain/ledger-entry";
import { reduceLedger } from "../domain/ledger-reducer";
import { toLedgerEntryValues } from "./ledger-entry-values";

export interface ContributeAndInvestInput {
  readonly portfolioId: PortfolioId;
  readonly effectiveDate: string;
  readonly cashAmount: string | number;
  readonly instrumentId: InstrumentId;
  readonly quantity: string | number;
  readonly unitPrice: string | number;
  readonly fee?: string | number;
  readonly note?: string;
}

export interface ContributeAndInvestResult {
  readonly contribution: ContributionEntry;
  readonly buy: BuyEntry;
}

/**
 * The atomic "contribute and invest" workflow (see the "Atomic contribute
 * and invest workflow" requirement and design.md decision 6): writes one
 * CONTRIBUTION and one BUY as separate, independently valid, linked
 * entries in a single PostgreSQL transaction, with the contribution
 * always ordered before the buy.
 *
 * Both entries are validated as standalone domain objects before the
 * transaction opens, so malformed input never touches the database. The
 * contribution is inserted first and the buy second — PostgreSQL's
 * `bigserial` sequence column guarantees the buy receives a strictly
 * greater sequence than the contribution even when both share the same
 * effective date, satisfying "contribution ordered before the buy"
 * without any application-level ordering logic. If either insert fails,
 * or the portfolio replay after both inserts would violate a ledger
 * invariant (e.g. the contribution amount does not actually cover the
 * buy's cost plus fee), the whole transaction rolls back and neither
 * entry is added (see "Combined workflow fails").
 */
export async function contributeAndInvest(
  ownerId: UserId,
  input: ContributeAndInvestInput,
): Promise<ContributeAndInvestResult> {
  const groupId = randomUUID();

  // Validate both entries as standalone domain objects up front; a
  // malformed contribution or buy is rejected before any transaction opens.
  const contributionCandidate = createContribution(ownerId, {
    portfolioId: input.portfolioId,
    effectiveDate: input.effectiveDate,
    cashAmount: input.cashAmount,
    note: input.note,
    groupId,
  });
  const buyCandidate = createBuy(ownerId, {
    portfolioId: input.portfolioId,
    effectiveDate: input.effectiveDate,
    instrumentId: input.instrumentId,
    quantity: input.quantity,
    unitPrice: input.unitPrice,
    fee: input.fee,
    note: input.note,
    groupId,
  });

  return db.transaction(async (tx) => {
    const contribution = await insert(tx, ownerId, toLedgerEntryValues(contributionCandidate));
    const buy = await insert(tx, ownerId, toLedgerEntryValues(buyCandidate));

    const entries = await listByPortfolio(tx, ownerId, input.portfolioId);
    reduceLedger(entries);

    return { contribution: contribution as ContributionEntry, buy: buy as BuyEntry };
  });
}
