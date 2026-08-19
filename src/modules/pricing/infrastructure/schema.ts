import { sql } from "drizzle-orm";
import {
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

/**
 * A dated, provider-attributed price for an owned instrument. `source`
 * defaults to `MANUAL` (the only source this change writes); the column
 * exists now so future automated-provider observations can coexist with
 * manual ones without a schema change.
 */
export const priceObservations = pgTable(
  "price_observations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerId: uuid("owner_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    instrumentId: uuid("instrument_id").notNull(),
    price: numeric("price", { precision: 20, scale: 8 }).notNull(),
    currency: text("currency").notNull().default("EUR"),
    effectiveDate: date("effective_date", { mode: "string" }).notNull(),
    source: text("source").notNull().default("MANUAL"),
    ingestedAt: timestamp("ingested_at", { withTimezone: true }).defaultNow().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("price_observations_owner_id_idx").on(table.ownerId),
    // The order deterministic as-of price selection depends on.
    index("price_observations_instrument_date_idx").on(table.instrumentId, table.effectiveDate),
    // At most one observation per instrument per effective date.
    unique("price_observations_instrument_id_effective_date_key").on(
      table.instrumentId,
      table.effectiveDate,
    ),
    foreignKey({
      columns: [table.ownerId, table.instrumentId],
      foreignColumns: [instruments.ownerId, instruments.id],
      name: "price_observations_owner_instrument_fk",
    }).onDelete("cascade"),
    check("price_observations_currency_eur_check", sql`${table.currency} = 'EUR'`),
    check("price_observations_price_positive_check", sql`${table.price} > 0`),
    check("price_observations_source_check", sql`${table.source} in ('MANUAL')`),
  ],
);
