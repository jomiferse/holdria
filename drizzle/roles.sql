-- Least-privilege PostgreSQL roles for Holdria.
--
-- Run this once against a fresh database, as a superuser/owner, before the
-- first migration. It is not applied automatically by Drizzle Kit: role
-- creation and password management are operator responsibilities, kept out
-- of versioned schema migrations so passwords never end up in migration
-- history.
--
-- holdria_migrator: owns and can alter every table (DDL). Used only by
--   `pnpm db:migrate` (MIGRATION_DATABASE_URL), run as an explicit release
--   step -- never by a running application replica.
-- holdria_app: DML only (SELECT/INSERT/UPDATE/DELETE) on application
--   tables, no DDL, no ability to create or drop roles/databases. Used by
--   the running application and by Better Auth (RUNTIME DATABASE_URL).
--
-- Replace the placeholder passwords before running outside local
-- development, and keep them out of version control (see .env.example).

create role holdria_migrator with login password 'holdria_migrator_password';
create role holdria_app with login password 'holdria_app_password';

grant create, connect on database holdria to holdria_migrator;
grant connect on database holdria to holdria_app;

grant usage, create on schema public to holdria_migrator;
grant usage on schema public to holdria_app;

-- Every table the migrator creates from now on is automatically usable by
-- holdria_app without a manual grant per migration.
alter default privileges for role holdria_migrator in schema public
  grant select, insert, update, delete on tables to holdria_app;
alter default privileges for role holdria_migrator in schema public
  grant usage, select on sequences to holdria_app;
