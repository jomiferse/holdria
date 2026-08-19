import { sql } from "drizzle-orm";
import { check, index, pgTable, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";

import { user } from "@/db/schema/auth-schema";

/**
 * A user-owned, EUR-denominated portfolio. `currency` is retained as a
 * column (not hard-coded) so a future change can widen supported
 * currencies without a schema migration; the MVP check constraint below
 * enforces the current EUR-only restriction.
 */
export const portfolios = pgTable(
  "portfolios",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerId: uuid("owner_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    currency: text("currency").notNull().default("EUR"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("portfolios_owner_id_idx").on(table.ownerId),
    // Referenced by composite foreign keys from child tables (ledger
    // entries, etc.) so PostgreSQL can enforce that a child row's owner
    // matches its parent portfolio's owner.
    unique("portfolios_owner_id_id_key").on(table.ownerId, table.id),
    check("portfolios_currency_eur_check", sql`${table.currency} = 'EUR'`),
  ],
);
