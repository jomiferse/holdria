CREATE TABLE "account" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" uuid NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp with time zone,
	"refresh_token_expires_at" timestamp with time zone,
	"scope" text,
	"password" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" uuid NOT NULL,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "portfolios" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL,
	"name" text NOT NULL,
	"currency" text DEFAULT 'EUR' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "portfolios_owner_id_id_key" UNIQUE("owner_id","id"),
	CONSTRAINT "portfolios_currency_eur_check" CHECK ("portfolios"."currency" = 'EUR')
);
--> statement-breakpoint
CREATE TABLE "instrument_external_references" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL,
	"instrument_id" uuid NOT NULL,
	"provider" text NOT NULL,
	"external_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "instrument_external_references_instrument_provider_key" UNIQUE("instrument_id","provider")
);
--> statement-breakpoint
CREATE TABLE "instruments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL,
	"type" text NOT NULL,
	"name" text NOT NULL,
	"isin" text,
	"ticker" text,
	"market" text,
	"currency" text DEFAULT 'EUR' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "instruments_owner_id_id_key" UNIQUE("owner_id","id"),
	CONSTRAINT "instruments_owner_id_isin_key" UNIQUE("owner_id","isin"),
	CONSTRAINT "instruments_type_check" CHECK ("instruments"."type" in ('FUND', 'ETF', 'STOCK')),
	CONSTRAINT "instruments_currency_eur_check" CHECK ("instruments"."currency" = 'EUR'),
	CONSTRAINT "instruments_fund_requires_isin_check" CHECK ("instruments"."type" <> 'FUND' or "instruments"."isin" is not null),
	CONSTRAINT "instruments_isin_format_check" CHECK ("instruments"."isin" is null or "instruments"."isin" ~ '^[A-Z]{2}[A-Z0-9]{9}[0-9]$')
);
--> statement-breakpoint
CREATE TABLE "ledger_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL,
	"portfolio_id" uuid NOT NULL,
	"instrument_id" uuid,
	"entry_type" text NOT NULL,
	"effective_date" date NOT NULL,
	"sequence" bigserial NOT NULL,
	"group_id" uuid,
	"cash_amount" numeric(20, 8),
	"quantity" numeric(20, 8),
	"unit_price" numeric(20, 8),
	"fee" numeric(20, 8),
	"currency" text DEFAULT 'EUR' NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ledger_entries_portfolio_id_sequence_key" UNIQUE("portfolio_id","sequence"),
	CONSTRAINT "ledger_entries_currency_eur_check" CHECK ("ledger_entries"."currency" = 'EUR'),
	CONSTRAINT "ledger_entries_entry_type_check" CHECK ("ledger_entries"."entry_type" in ('CONTRIBUTION', 'WITHDRAWAL', 'BUY', 'SELL')),
	CONSTRAINT "ledger_entries_cash_fields_check" CHECK ((
        "ledger_entries"."entry_type" in ('CONTRIBUTION', 'WITHDRAWAL')
        and "ledger_entries"."cash_amount" is not null and "ledger_entries"."cash_amount" > 0
        and "ledger_entries"."instrument_id" is null
        and "ledger_entries"."quantity" is null
        and "ledger_entries"."unit_price" is null
        and "ledger_entries"."fee" is null
      ) or "ledger_entries"."entry_type" in ('BUY', 'SELL')),
	CONSTRAINT "ledger_entries_trade_fields_check" CHECK ((
        "ledger_entries"."entry_type" in ('BUY', 'SELL')
        and "ledger_entries"."instrument_id" is not null
        and "ledger_entries"."quantity" is not null and "ledger_entries"."quantity" > 0
        and "ledger_entries"."unit_price" is not null and "ledger_entries"."unit_price" > 0
        and ("ledger_entries"."fee" is null or "ledger_entries"."fee" >= 0)
        and "ledger_entries"."cash_amount" is null
      ) or "ledger_entries"."entry_type" in ('CONTRIBUTION', 'WITHDRAWAL'))
);
--> statement-breakpoint
CREATE TABLE "price_observations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL,
	"instrument_id" uuid NOT NULL,
	"price" numeric(20, 8) NOT NULL,
	"currency" text DEFAULT 'EUR' NOT NULL,
	"effective_date" date NOT NULL,
	"source" text DEFAULT 'MANUAL' NOT NULL,
	"ingested_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "price_observations_instrument_id_effective_date_key" UNIQUE("instrument_id","effective_date"),
	CONSTRAINT "price_observations_currency_eur_check" CHECK ("price_observations"."currency" = 'EUR'),
	CONSTRAINT "price_observations_price_positive_check" CHECK ("price_observations"."price" > 0),
	CONSTRAINT "price_observations_source_check" CHECK ("price_observations"."source" in ('MANUAL'))
);
--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "portfolios" ADD CONSTRAINT "portfolios_owner_id_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "instrument_external_references" ADD CONSTRAINT "instrument_external_references_owner_id_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "instrument_external_references" ADD CONSTRAINT "instrument_external_references_instrument_id_instruments_id_fk" FOREIGN KEY ("instrument_id") REFERENCES "public"."instruments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "instrument_external_references" ADD CONSTRAINT "instrument_external_references_owner_instrument_fk" FOREIGN KEY ("owner_id","instrument_id") REFERENCES "public"."instruments"("owner_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "instruments" ADD CONSTRAINT "instruments_owner_id_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_owner_id_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_owner_portfolio_fk" FOREIGN KEY ("owner_id","portfolio_id") REFERENCES "public"."portfolios"("owner_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_owner_instrument_fk" FOREIGN KEY ("owner_id","instrument_id") REFERENCES "public"."instruments"("owner_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "price_observations" ADD CONSTRAINT "price_observations_owner_id_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "price_observations" ADD CONSTRAINT "price_observations_owner_instrument_fk" FOREIGN KEY ("owner_id","instrument_id") REFERENCES "public"."instruments"("owner_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "account_userId_idx" ON "account" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "session_userId_idx" ON "session" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "verification_identifier_idx" ON "verification" USING btree ("identifier");--> statement-breakpoint
CREATE INDEX "portfolios_owner_id_idx" ON "portfolios" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "instrument_external_references_owner_id_idx" ON "instrument_external_references" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "instruments_owner_id_idx" ON "instruments" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "ledger_entries_owner_id_idx" ON "ledger_entries" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "ledger_entries_portfolio_order_idx" ON "ledger_entries" USING btree ("portfolio_id","effective_date","sequence");--> statement-breakpoint
CREATE INDEX "price_observations_owner_id_idx" ON "price_observations" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "price_observations_instrument_date_idx" ON "price_observations" USING btree ("instrument_id","effective_date");