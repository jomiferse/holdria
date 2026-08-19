# Holdria

Track investment portfolios without spreadsheets or broker integrations.
Holdria is a self-hosted, EUR-only MVP: one Next.js application backed by
its own PostgreSQL database, with no required Vercel or managed
authentication service. See `openspec/changes/build-holdria-mvp/` (proposal,
design, specs, tasks) for the product and architecture decisions this
codebase implements.

## Stack

Next.js App Router, TypeScript, Tailwind CSS, shadcn/ui, Zod, Recharts,
Drizzle ORM, self-hosted PostgreSQL, Better Auth, Vitest, Playwright.

## Local development

Requirements: Node.js 22+, pnpm, Docker (for PostgreSQL and Mailpit).

```bash
cp .env.example .env          # then set a real BETTER_AUTH_SECRET
docker compose up -d postgres mailpit
pnpm install
pnpm db:migrate                # applies drizzle/*.sql with the migrator role
pnpm dev
```

- App: http://localhost:3000
- Mailpit (captures dev emails): http://localhost:8025
- Liveness: `GET /api/health` — process only, never touches PostgreSQL.
- Readiness: `GET /api/health/ready` — 200 when PostgreSQL is reachable, 503 otherwise.

`drizzle/roles.sql` creates two least-privilege PostgreSQL roles the first
time the `postgres` container initializes its data directory:
`holdria_app` (runtime DML only) and `holdria_migrator` (DDL, used only by
`pnpm db:migrate`/`db:generate`). `.env.example` already points
`DATABASE_URL`/`MIGRATION_DATABASE_URL` at them.

### Database network access

PostgreSQL must never be reachable from the public internet. In any
deployment (Compose or otherwise), only these paths should be able to open
a connection: the application container(s) (`holdria_app`), the release
step that runs migrations (`holdria_migrator`), interactive administration
from an operator's trusted network (e.g. over a VPN or SSH tunnel, using a
superuser role reserved for that purpose), and the backup process. In
`docker-compose.yml` this is the Compose network itself — `postgres` has no
published port requirement beyond local development convenience (`5432` is
exposed only so `pnpm db:migrate`/`db:studio` can run from the host); a
production topology should bind PostgreSQL to a private network or
security group with no public ingress, terminate operator access through a
bastion/VPN, and expose no PostgreSQL port to the internet at all.

## Scripts

| Script | Purpose |
| --- | --- |
| `pnpm dev` / `build` / `start` | Next.js dev server / production build / production server |
| `pnpm lint` / `typecheck` | ESLint / `tsc --noEmit` |
| `pnpm test` / `test:watch` | Vitest |
| `pnpm db:generate` | Diff `src/db/schema` against `drizzle/` and write a new SQL migration |
| `pnpm db:migrate` | Apply pending migrations using `MIGRATION_DATABASE_URL` |
| `pnpm db:studio` | Drizzle Studio |
| `pnpm db:auth:generate` | Regenerate `src/db/schema/auth-schema.ts` from Better Auth's options (see that file's header comment — UUID ids must be reapplied by hand) |

## Architecture

One deployable application with explicit module boundaries — not
microservices. See `openspec/changes/build-holdria-mvp/design.md` for the
full rationale.

```text
src/
  app/            # routes, layouts, loading/error states, composition
  modules/        # identity, portfolio, instruments, transactions, pricing, analytics
                   #   each may have domain/ application/ infrastructure/ interface/
  shared/         # cross-module value concepts only: UserId, base domain errors, ...
  components/ui   # shadcn/ui primitives
  components/layout
  db/client       # runtime PostgreSQL pool + Drizzle instance
  db/schema       # aggregates every module's infrastructure/schema.ts
  config/env.ts   # validated, server-only environment configuration
drizzle/          # versioned SQL migrations + roles.sql
```

Server Components call application queries directly; they never query
Drizzle or calculate finance themselves. Server Actions parse Zod input,
resolve the authenticated actor, invoke one application command, and map
expected errors. See each module's own files for module-specific
conventions as they land.

## Docker

```bash
docker compose up -d   # postgres + mailpit + app (multi-stage, non-root, standalone Next.js)
```

The image validates its environment at startup and stores no durable state
on its own filesystem; PostgreSQL is a separate, persistently backed
service. Migrations are an explicit release step (`pnpm db:migrate`), never
run automatically by an application replica at startup.
