import { sql } from "drizzle-orm";
import {
  bigserial,
  check,
  date,
  foreignKey,
  index,
  numeric,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";

import { user } from "@/db/schema/auth-schema";
import { instruments } from "@/modules/instruments/infrastructure/schema";
import { portfolios } from "@/modules/portfolio/infrastructure/schema";

/**
 * A single cash or trade movement in a portfolio's ledger.
 *
 * This intentionally stays one discriminated table rather than one table
 * per entry type: every derived figure (cash, positions, cost, result)
 * must be produced by replaying entries in one deterministic
 * `(effective_date, sequence)` order, which is far simpler over one
 * ordered stream than a union across several tables. Type-specific
 * nullability is constrained below so PostgreSQL rejects a CONTRIBUTION
 * carrying trade fields (or a BUY missing them) even if application code
 * has a bug.
 *
 * `sequence` is a global, monotonically increasing identity, not reset
 * per portfolio: uniqueness and strict ordering are what the replay needs,
 * and a global sequence gives both without per-portfolio counter
 * bookkeeping. Concurrency-safe allocation and full replay validation are
 * implemented in the transactions application layer, not in this schema.
 */
export const ledgerEntries = pgTable(
  "ledger_entries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerId: uuid("owner_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    portfolioId: uuid("portfolio_id").notNull(),
    instrumentId: uuid("instrument_id"),
    entryType: text("entry_type").notNull(),
    effectiveDate: date("effective_date", { mode: "string" }).notNull(),
    sequence: bigserial("sequence", { mode: "bigint" }).notNull(),
    /** Links the CONTRIBUTION and BUY written by one atomic contribute-and-invest command. Null for standalone entries. */
    groupId: uuid("group_id"),
    /** CONTRIBUTION/WITHDRAWAL only. */
    cashAmount: numeric("cash_amount", { precision: 20, scale: 8 }),
    /** BUY/SELL only. */
    quantity: numeric("quantity", { precision: 20, scale: 8 }),
    /** BUY/SELL only. */
    unitPrice: numeric("unit_price", { precision: 20, scale: 8 }),
    /** BUY/SELL only; non-negative, defaults to 0. */
    fee: numeric("fee", { precision: 20, scale: 8 }),
    currency: text("currency").notNull().default("EUR"),
    note: text("note"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("ledger_entries_owner_id_idx").on(table.ownerId),
    // The order every replay and derived calculation depends on.
    index("ledger_entries_portfolio_order_idx").on(
      table.portfolioId,
      table.effectiveDate,
      table.sequence,
    ),
    unique("ledger_entries_portfolio_id_sequence_key").on(table.portfolioId, table.sequence),
    foreignKey({
      columns: [table.ownerId, table.portfolioId],
      foreignColumns: [portfolios.ownerId, portfolios.id],
      name: "ledger_entries_owner_portfolio_fk",
    }).onDelete("cascade"),
    // Nullable composite FK: satisfied trivially when instrumentId is
    // null (cash entries), enforced for BUY/SELL.
    foreignKey({
      columns: [table.ownerId, table.instrumentId],
      foreignColumns: [instruments.ownerId, instruments.id],
      name: "ledger_entries_owner_instrument_fk",
    }),
    check("ledger_entries_currency_eur_check", sql`${table.currency} = 'EUR'`),
    check(
      "ledger_entries_entry_type_check",
      sql`${table.entryType} in ('CONTRIBUTION', 'WITHDRAWAL', 'BUY', 'SELL')`,
    ),
    check(
      "ledger_entries_cash_fields_check",
      sql`(
        ${table.entryType} in ('CONTRIBUTION', 'WITHDRAWAL')
        and ${table.cashAmount} is not null and ${table.cashAmount} > 0
        and ${table.instrumentId} is null
        and ${table.quantity} is null
        and ${table.unitPrice} is null
        and ${table.fee} is null
      ) or ${table.entryType} in ('BUY', 'SELL')`,
    ),
    check(
      "ledger_entries_trade_fields_check",
      sql`(
        ${table.entryType} in ('BUY', 'SELL')
        and ${table.instrumentId} is not null
        and ${table.quantity} is not null and ${table.quantity} > 0
        and ${table.unitPrice} is not null and ${table.unitPrice} > 0
        and (${table.fee} is null or ${table.fee} >= 0)
        and ${table.cashAmount} is null
      ) or ${table.entryType} in ('CONTRIBUTION', 'WITHDRAWAL')`,
    ),
  ],
);
