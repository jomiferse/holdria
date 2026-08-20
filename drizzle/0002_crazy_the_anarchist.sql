-- Forward-safe expand/backfill/constrain migration (replaces an earlier,
-- unsafe direct `ADD COLUMN ... NOT NULL` that would fail immediately on
-- any database already holding an "account" row — PostgreSQL requires a
-- default or an empty table to add a NOT NULL column in one step, and this
-- column intentionally has no default because its correct value depends on
-- each row's existing "provider_id").
--
-- 1. Expand: add the column nullable, so the statement succeeds regardless
--    of existing rows.
ALTER TABLE "account" ADD COLUMN "issuer" text;--> statement-breakpoint
-- 2. Backfill: give every existing row the same synthetic local-issuer
--    value Better Auth's `createLocalAccountIssuer` computes at runtime
--    (`local:<provider_id>`, e.g. "local:credential" for this
--    application's email/password accounts — see auth-schema.ts's comment
--    on this column and @better-auth/core's db/schema/account.ts).
UPDATE "account" SET "issuer" = 'local:' || "provider_id" WHERE "issuer" IS NULL;--> statement-breakpoint
-- 3. Constrain: every row now has a value, so this can never fail.
ALTER TABLE "account" ALTER COLUMN "issuer" SET NOT NULL;
