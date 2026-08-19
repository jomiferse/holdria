import { sql } from "drizzle-orm";
import { check, foreignKey, index, pgTable, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";

import { user } from "@/db/schema/auth-schema";

/**
 * A user-owned, reusable investment definition (fund, ETF, or stock).
 * ISIN is first-class and normalized to canonical uppercase; it is
 * required for FUND and optional (but still unique per owner when
 * present) for ETF/STOCK, which instead carry ticker + market.
 */
export const instruments = pgTable(
  "instruments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerId: uuid("owner_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    name: text("name").notNull(),
    isin: text("isin"),
    ticker: text("ticker"),
    market: text("market"),
    currency: text("currency").notNull().default("EUR"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("instruments_owner_id_idx").on(table.ownerId),
    // Referenced by composite foreign keys from ledger entries, price
    // observations, and external references so a child row's owner must
    // match its parent instrument's owner.
    unique("instruments_owner_id_id_key").on(table.ownerId, table.id),
    // Per-owner ISIN uniqueness. PostgreSQL treats NULLs as distinct by
    // default, so instruments without an ISIN (ETF/STOCK may omit it)
    // never collide with each other.
    unique("instruments_owner_id_isin_key").on(table.ownerId, table.isin),
    check("instruments_type_check", sql`${table.type} in ('FUND', 'ETF', 'STOCK')`),
    check("instruments_currency_eur_check", sql`${table.currency} = 'EUR'`),
    check("instruments_fund_requires_isin_check", sql`${table.type} <> 'FUND' or ${table.isin} is not null`),
    check(
      "instruments_isin_format_check",
      sql`${table.isin} is null or ${table.isin} ~ '^[A-Z]{2}[A-Z0-9]{9}[0-9]$'`,
    ),
  ],
);

/**
 * Provider-neutral link between an owned instrument and an external
 * pricing/search provider's identifier. No provider is implemented in
 * this change; this table only reserves the persistence shape so
 * `pricing` ports can be wired to a real adapter later without a schema
 * change.
 */
export const instrumentExternalReferences = pgTable(
  "instrument_external_references",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerId: uuid("owner_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    instrumentId: uuid("instrument_id")
      .notNull()
      .references(() => instruments.id, { onDelete: "cascade" }),
    provider: text("provider").notNull(),
    externalId: text("external_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("instrument_external_references_owner_id_idx").on(table.ownerId),
    unique("instrument_external_references_instrument_provider_key").on(
      table.instrumentId,
      table.provider,
    ),
    // Composite FK: guarantees the referenced instrument's owner matches
    // this row's owner, so a client-supplied instrumentId can never link
    // to another user's instrument even if ownerId were spoofed.
    foreignKey({
      columns: [table.ownerId, table.instrumentId],
      foreignColumns: [instruments.ownerId, instruments.id],
      name: "instrument_external_references_owner_instrument_fk",
    }).onDelete("cascade"),
  ],
);
