# Deployment

Configuration and operational procedures for running Holdria outside local
development: test, staging, and production. See the root `README.md` for
local development setup, and `openspec/changes/build-holdria-mvp/design.md`
decision 11 for the architectural constraints this document follows (no
Vercel, no managed authentication or database service, portable Docker
container, migrations as an explicit release step).

## Contents

- [Environment configuration by stage](#environment-configuration-by-stage)
- [Better Auth secrets and trusted origins](#better-auth-secrets-and-trusted-origins)
- [HTTPS reverse proxy](#https-reverse-proxy)
- [SMTP](#smtp)
- [Database roles and network access](#database-roles-and-network-access)
- [Migration procedure](#migration-procedure)
- [PostgreSQL backup and restore](#postgresql-backup-and-restore)
- [Optional observability](#optional-observability)
- [Release workflow](#release-workflow)
- [Clean deployment verification](#clean-deployment-verification)

## Environment configuration by stage

Every variable is validated at process startup by `src/config/env.ts`; the
app refuses to boot rather than run with a missing or malformed value. Full
reference and inline documentation: `.env.example` (local/staging/production
shape) and `.env.test.example` (test database, used by
`pnpm test:integration` and `pnpm exec playwright test`).

| Stage | `.env` source | Database | SMTP | `BETTER_AUTH_URL` |
| --- | --- | --- | --- | --- |
| Local development | `.env` (from `.env.example`) | `docker-compose.yml`'s `postgres`, database `holdria` | Mailpit (`docker-compose.yml`), captures mail | `http://localhost:3000` |
| Test (unit/integration/e2e) | `.env.test` (from `.env.test.example`) | same PostgreSQL server, database `holdria_test` | Mailpit, or any reachable SMTP — tests don't assert delivered content | `http://localhost:3100` (Playwright's `webServer`) |
| Staging | environment secrets (CI environment or host secret store), never committed | operator-managed PostgreSQL, staging data | real or staging-safe SMTP relay | staging's real public origin |
| Production | environment secrets (CI environment or host secret store), never committed | operator-managed PostgreSQL, backed up (below) | production SMTP relay with a verified sending domain | production's real public origin |

Never commit `.env`, `.env.test`, or any file holding a real secret — both
are already covered by `.gitignore`'s `.env*` pattern. Only the `*.example`
files are checked in.

## Better Auth secrets and trusted origins

- `BETTER_AUTH_SECRET` signs sessions and tokens. Generate a fresh,
  unique value per environment — `openssl rand -base64 32` — and never
  reuse the development or `.env.example` placeholder. Rotating it
  invalidates every existing session, so treat rotation as a deliberate,
  user-visible action (forces re-authentication), not routine hygiene.
- `BETTER_AUTH_URL` must be the exact public origin users load in their
  browser (scheme, host, and port if non-default). It is embedded in
  verification and password-reset links and used for cookie scoping; a
  mismatch breaks both.
- `TRUSTED_ORIGINS` is a comma-separated allowlist Better Auth checks
  incoming requests' `Origin`/`Referer` against (CSRF protection —
  `disableCSRFCheck` stays `false` in `auth.ts`). Include
  `BETTER_AUTH_URL`'s origin and any other origin the app is reachable
  from (e.g. both a bare domain and its `www` subdomain, if both resolve
  to this deployment). Do not add origins you do not control.
- Cookies are `Secure`, `HttpOnly`, and same-site whenever `NODE_ENV`
  is `production` (`auth.ts`'s `useSecureCookies`), which requires the
  app to actually be served over HTTPS — see the reverse-proxy section
  below. Serving `NODE_ENV=production` over plain HTTP silently breaks
  sign-in, because the browser refuses to send/store an insecure
  `Secure` cookie.
- Session storage is database-backed with cookie caching disabled
  (`auth.ts`'s `cookieCache.enabled: false`), so revocation, password
  reset, and account deletion take effect immediately rather than
  waiting out a cached session cookie — no additional configuration
  needed to preserve that property across environments.

## HTTPS reverse proxy

The application container is plain HTTP on `PORT` (default `3000`) and
never terminates TLS itself (design.md decision 11: "TLS termination and
trusted proxy headers are configured explicitly at the reverse proxy").
Put any standard reverse proxy in front of it; two examples:

**Caddy** (`Caddyfile`, automatic HTTPS via Let's Encrypt):

```caddyfile
app.example.com {
    reverse_proxy holdria-app:3000
}
```

**nginx** (assumes a certificate already provisioned, e.g. via certbot):

```nginx
server {
    listen 443 ssl;
    server_name app.example.com;

    ssl_certificate     /etc/letsencrypt/live/app.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/app.example.com/privkey.pem;

    location / {
        proxy_pass http://holdria-app:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

server {
    listen 80;
    server_name app.example.com;
    return 301 https://$host$request_uri;
}
```

Either way:

- `BETTER_AUTH_URL` and `TRUSTED_ORIGINS` must use `https://` and match
  the proxy's public hostname, not the container's internal address.
- Forward `X-Forwarded-Proto`/`Host` (shown above) so the app and Better
  Auth see the original scheme and host, not the proxy's internal HTTP
  connection.
- Point the proxy's own health check at `GET /api/health` (liveness —
  process only) rather than `/api/health/ready`, so a transient
  PostgreSQL blip doesn't make the proxy stop routing to an
  otherwise-healthy container; use `/api/health/ready` for an
  orchestrator's traffic-routing/restart decisions instead, per the
  distinction documented on each route handler.

## SMTP

Verification, password-reset, and account-security email is sent through
`nodemailer` against standard SMTP settings
(`src/modules/identity/infrastructure/email/smtp-email-port.ts`) — no
managed email API or SDK. Configure:

```
SMTP_HOST=smtp.your-provider.example
SMTP_PORT=587
SMTP_SECURE=false        # true only for implicit TLS (typically port 465)
SMTP_USER=...
SMTP_PASSWORD=...
SMTP_FROM=no-reply@your-domain.example
```

Any standard SMTP relay works (a self-hosted MTA, or a provider's SMTP
endpoint used only as a relay). Requirements independent of which relay is
chosen:

- `SMTP_FROM` should be a verified sender on a domain with correct
  SPF/DKIM/DMARC records, or verification and reset email will land in
  spam or be rejected outright — this is a DNS/provider configuration
  concern outside the application, not something Holdria's code can fix.
- Delivery failures are observable at the SMTP relay/transport level
  (`smtp-email-port.ts` lets `sendMail` rejections propagate); route relay
  logs or bounce notifications to wherever the operator watches
  operational alerts.
- UI responses to password-reset requests stay generic regardless of
  whether the address exists (anti-enumeration — see
  `specs/identity/user-access/spec.md`), so delivery problems are only
  visible via relay logs/bounces, never via the product UI itself.

Local development and the test suite use Mailpit
(`docker-compose.yml`'s `mailpit` service) as a throwaway SMTP server that
captures mail instead of delivering it — not a production recommendation.

## Database roles and network access

Covered in full in `drizzle/roles.sql` and the root `README.md`'s
"Database network access" section; summarized here:

- `holdria_migrator` (DDL) is used only by `pnpm db:migrate` /
  `pnpm db:generate`, run as an explicit release step.
- `holdria_app` (DML only) is `DATABASE_URL` — what the running
  application and Better Auth use. It cannot create, alter, or drop
  tables.
- PostgreSQL should have no public ingress in any deployment. Only the
  application container(s), the release step that runs migrations,
  operator administration over a bastion/VPN, and the backup process
  should be able to reach it.

## Migration procedure

Migrations are versioned SQL files under `drizzle/`, generated by
`pnpm db:generate` (Drizzle Kit diffing `src/db/schema` against the
existing migration history) and reviewed like any other code change
before being applied. They are **never** run automatically by an
application replica at startup (design.md decision 11) — only as an
explicit release step, so that:

- a bad migration cannot be triggered by an autoscaling event or a
  crash-loop restart;
- multiple replicas starting concurrently never race to apply the same
  migration; and
- an operator/reviewer can see exactly which migration is about to run
  against a real database, and when.

**Procedure:**

1. Generate the migration locally (`pnpm db:generate`), review the
   resulting SQL under `drizzle/` (checked into the repository), and get
   it reviewed like any other schema change. Follow forward-compatible
   expand/contract migrations once real user data exists — never a
   migration that drops or rewrites ledger or price data destructively
   (design.md's Migration Plan).
2. Apply it with `pnpm db:migrate`, using `MIGRATION_DATABASE_URL` for
   the target environment. This project's release workflow
   (`.github/workflows/release.yml`) exposes this as its own `migrate`
   job, gated behind a GitHub Environment an operator configures per
   target (staging/production), so it only runs when explicitly
   dispatched (`workflow_dispatch`) with that environment selected — see
   the job's comments for setup. Running it by hand against a target
   database (e.g. from an operator's own machine, or a one-off deployment
   host command) is equally valid; the workflow job exists for
   auditability and optional reviewer gating, not because it is the only
   supported path.
3. Only after migrations have been applied — and `pnpm verify:migrations`
   (`scripts/verify-migration-set.mjs`) confirms the target database's
   applied migrations are the *exact same ordered set* this release
   ships (same count, same per-migration content hash, same order — not
   just a count comparison, which cannot tell "the right migrations"
   apart from "some other migrations that happen to total the same
   number") — should new application replicas serving the new schema be
   rolled out (or an existing replica restarted onto the new image). The
   release workflow enforces this at the image level, not just by job
   ordering: `docker` pushes only an immutable, content-addressed
   candidate tag (`sha-<commit>`), never `:latest` or the release's own
   tag name, so nothing tracking a deployable tag can pull an unmigrated
   build. Only the `promote` job — which runs after `migrate` succeeds,
   gated behind the same environment/manual approval, and consumes the
   exact digest `docker` pushed in that same dispatched run — re-tags
   that digest (no rebuild) as the deployable tag(s) an operator's
   deployment actually tracks. Trigger any deployment step from
   `promote`'s success, not from `docker`'s.
4. Rollback: before real user data exists, the simplest rollback is
   dropping and recreating the schema from `drizzle/`. Once production
   data exists, roll back the *application* to the prior compatible
   image; do not write or apply a migration that discards ledger or
   price data to "undo" a schema change — write a new forward migration
   instead.

## PostgreSQL backup and restore

PostgreSQL is a separately backed-up service; its data directory is not
part of the stateless application container (design.md decision 11).
Standard `pg_dump`/`pg_restore` are sufficient at Holdria's expected data
size — no vendor-specific backup product is required or assumed.

**Backup** (run from anywhere with network access to PostgreSQL and a role
with read access to every table, e.g. `holdria_migrator` or a dedicated
backup role — never a public/unauthenticated path):

```bash
pg_dump --format=custom \
  --dbname="postgresql://holdria_migrator:<password>@<host>:5432/holdria" \
  --file="holdria-$(date +%Y%m%d-%H%M%S).dump"
```

Encrypt the resulting dump at rest and in transit to wherever it is
stored (design.md risk: "Automate encrypted backups, test restoration,
monitor storage and connections"), and automate this on a schedule
appropriate to acceptable data loss (e.g. a daily cron/systemd timer next
to the database host, or the managed backup feature of whatever
PostgreSQL hosting is chosen — an operator decision, not an architectural
requirement).

**Restore**, into a fresh, empty database (verify this procedure
periodically against a scratch database — an untested backup is not a
backup):

```bash
createdb -U <superuser> holdria_restored
pg_restore --dbname="postgresql://<superuser>@<host>:5432/holdria_restored" \
  --no-owner --role=holdria_migrator \
  holdria-20260101-120000.dump
```

Then re-run `drizzle/roles.sql` against the restored database if roles
were not part of the dump (role creation is intentionally kept out of
versioned migrations — see that file's header comment), point a
`MIGRATION_DATABASE_URL`/`DATABASE_URL` at it, and confirm the
application starts and both health endpoints respond before treating the
restore as usable.

## Optional observability

`OBSERVABILITY_DSN` (`src/config/env.ts`) is a reserved, validated
configuration slot for a structured-logging/error-monitoring sink — no
specific vendor or product is wired into application code (design.md's
open questions: "Which... error-monitoring implementations will be
configured before public launch?" is deliberately left to the operator).
Leaving it unset disables it entirely; the application does not require
an observability backend to run correctly. If configured, keep the same
privacy-safe logging boundary the rest of the application follows: no
credentials, tokens, portfolio values, ledger amounts, or unnecessary
personal data (design.md task 9.4) — an observability sink is an
additional place that boundary must hold, not an exception to it.

Independent of `OBSERVABILITY_DSN`, `GET /api/health` (liveness) and
`GET /api/health/ready` (PostgreSQL reachability) are the two signals a
reverse proxy, orchestrator, or uptime monitor should watch (see the
reverse-proxy section above for which to use where).

## Release workflow

`.github/workflows/release.yml` has four jobs: `checks` -> `docker` ->
`migrate` -> `promote`.

`checks` runs, on every push and pull request: lint, both production
builds (`next build` and `next build --webpack`), type checking, unit
tests, PostgreSQL-backed integration tests, and Playwright end-to-end
tests against a throwaway `holdria_test` database in a service container.
`docker` then builds and smoke-tests the production Docker image (starts
it against a throwaway PostgreSQL container and checks both health
endpoints); nothing in `checks` or `docker` touches a real
staging/production database or deployment target.

`docker` also pushes an immutable candidate image tag, `sha-<commit>` —
never `:latest` or the release's own tag name (finding: "Release gating"
— a deployable tag must never become pullable before its migration has
succeeded) — on two kinds of trigger:

- an ordinary `push` to `main`/a `v*` tag, purely for audit/testing of
  that commit's image; `migrate`/`promote` never run for a `push` event,
  so this alone can never make a deployable tag pullable;
- a `workflow_dispatch` run — **the real release path**. A single
  dispatched run (with `environment` set to a configured GitHub
  Environment) builds and pushes its own candidate in that same run,
  captures the exact digest as a job output (`docker.outputs.candidate-digest`),
  and passes it on to `migrate` and `promote` below. A dispatched run's
  candidate publication and its migration/promotion are never split
  across separate, mutually exclusive triggers — the same run does both,
  so there is always a digest for `migrate`/`promote` to act on.

`migrate` and `promote` both run only for that `workflow_dispatch` path
(`github.event_name == 'workflow_dispatch' && inputs.environment != ''`),
gated behind the same GitHub Environment approval:

1. `migrate` applies the reviewed migration(s) to that environment's
   database (previous section), then runs `pnpm verify:migrations`
   (`scripts/verify-migration-set.mjs`) — a schema compatibility check
   that compares the *complete ordered set* of migrations this checkout
   ships against what `drizzle.__drizzle_migrations` actually records:
   same count, same per-migration identity (the sha256 content hash
   `drizzle-orm`'s own migrator computes and stores — not an invented
   parallel version scheme), same order. It fails the job (and blocks
   promotion) if a required migration is missing, an unexpected one is
   present, the order/identity doesn't match, or the database is
   otherwise not at exactly the schema state this release expects.
2. `promote` — which only runs if both `docker` and `migrate` succeeded
   — re-tags the exact digest `docker` pushed in this run (via
   `docker buildx imagetools create`, no rebuild — the promoted bytes are
   byte-identical to what `checks` and `migrate` verified) as `:latest`
   (dispatched against `main`) or the pushed tag's own name (a `v*`
   tag), the tag(s) an operator's deployment or autoscaling actually
   tracks. Trigger any deployment step (redeploying a service, restarting
   replicas onto the new image) from `promote`'s success.

Nothing makes a deployable tag pullable except `promote`, and `promote`
never runs unless this same dispatched run's own `migrate` step already
succeeded against the named environment's database.

## Clean deployment verification

To verify an operator-controlled deployment from nothing (task 10.6),
starting from a machine with only Docker and this repository:

1. `docker compose build app` — builds the exact multi-stage image
   described in `Dockerfile` (non-root, standalone Next.js server, no
   durable filesystem state).
2. `docker compose up -d postgres mailpit` — starts a fresh PostgreSQL
   with the roles from `drizzle/roles.sql` applied via its init script,
   and a throwaway SMTP capture server.
3. `pnpm db:migrate` (or the release workflow's `migrate` job against
   this target) — apply every migration as the explicit release step;
   confirm it completes without error and that
   `psql ... -c '\dt'` lists every expected table (Better Auth's `user`,
   `session`, `account`, `verification`, `rate_limit`, plus `portfolios`,
   `instruments`, `instrument_external_references`, `ledger_entries`,
   `price_observations`).
4. `docker compose up -d app` — start the application container against
   the now-migrated database.
5. **Smoke checks:**
   - `curl http://localhost:3000/api/health` returns `200` with
     `{"status":"ok"}`.
   - `curl http://localhost:3000/api/health/ready` returns `200` with
     `{"status":"ready","database":"reachable"}`.
6. **Authentication and deletion checks** — exercised automatically by
   `e2e/registration-and-session.spec.ts` and
   `e2e/account-deletion.spec.ts` (register, verify, sign in/out, delete
   account and confirm the account and its data are gone); run
   `pnpm exec playwright test` against the deployed instance
   (`PLAYWRIGHT_BASE_URL`/`playwright.config.ts`'s `use.baseURL`, or by
   pointing `.env.test` at the deployment) to confirm this against a real
   built-and-started container rather than only the dev server.
7. **Tenant-isolation checks** — exercised automatically by
   `e2e/portfolios.spec.ts`'s "does not let one user reach another user's
   portfolio" case, which asserts that a second authenticated user
   cannot load a first user's portfolio by ID.
8. **Accessibility smoke checks** — `e2e/accessibility-smoke.spec.ts` runs
   an automated axe-core scan (`@axe-core/playwright`) against sign-in,
   sign-up, forgot-password, the authenticated portfolio-onboarding page,
   and the account page, failing on any automatically detectable
   violation (missing labels, insufficient contrast, invalid ARIA, etc.).
   Every other core-flow Playwright spec also drives forms and navigation
   through `getByRole`/`getByLabel` locators, which fail if the
   corresponding accessible name/role is missing — running the full suite
   against the deployed instance exercises both. This is a smoke check,
   not the broader manual/automated accessibility audit tracked
   separately as task 9.3 in `openspec/changes/build-holdria-mvp/tasks.md`.

A deployment only counts as verified once steps 1–7 have actually been
run against a freshly built image and a freshly migrated database — not
against a developer's already-running `pnpm dev` environment.
