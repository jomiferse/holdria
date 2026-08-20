## Context

Holdria starts from an empty repository and must deliver the behavior defined by the six delta specs in this change. It will be a publicly accessible but initially low-traffic product that stores sensitive personal investment data. The implementation must remain simple enough for one primary implementer to build and operate while preserving deterministic financial behavior, tenant isolation, and a path to automated pricing.

The fixed stack is Next.js App Router with TypeScript, Tailwind CSS, shadcn/ui, Zod, Recharts, Drizzle, self-hosted PostgreSQL, Better Auth, Vitest, and Playwright. Holdria must run entirely on infrastructure controlled by its operator, with no managed authentication or database service required at runtime. Deployment must work as portable Docker containers and must not require Vercel.

## Goals / Non-Goals

**Goals:**

- Keep one deployable full-stack application with explicit module boundaries.
- Keep domain calculations independent from Next.js, Better Auth, Drizzle, and price providers.
- Make the ledger and price observations the authoritative financial inputs.
- Guarantee deterministic replay, precise decimal arithmetic, and testable return calculations.
- Isolate each user's data at every application and persistence boundary.
- Make manual pricing useful now and external pricing additive later.
- Deliver a responsive, accessible, trustworthy product experience rather than a prototype UI.
- Keep Better Auth confined to identity infrastructure without building speculative multi-provider abstractions.

**Non-Goals:**

- Separate frontend and backend deployments, microservices, event sourcing, Redis, queues, or a public API.
- Direct browser access to PostgreSQL or business tables.
- Automated price providers, scheduled price ingestion, broker imports, payments, or plans.
- FX conversion, multi-currency portfolios, tax accounting, FIFO, dividends, or corporate actions.
- Persistent position projections, materialized analytics read models, or sophisticated snapshot invalidation in the first increment.
- Selecting a particular VPS, container host, reverse proxy, SMTP implementation, or observability product as an architectural requirement.

## Decisions

### 1. Use a modular full-stack monolith

One Next.js application will contain presentation, application, domain, and infrastructure code. Modules are code ownership and dependency boundaries, not independently deployed services.

The dependency direction is:

```text
identity
   |
   +--> portfolio
   +--> instruments

portfolio + instruments --> transactions
instruments             --> pricing
portfolio + transactions + instruments + pricing --> analytics
```

- `identity` resolves the authenticated actor and owns the internal user record.
- `portfolio` owns portfolio lifecycle, ownership, name, and base currency.
- `instruments` owns user-defined instruments, ISIN and market identifiers, currency, and future provider references.
- `transactions` owns ledger invariants and the accounting replay needed to validate cash, units, weighted-average cost, and realized result.
- `pricing` owns price observations, as-of selection, provenance, and external provider ports.
- `analytics` combines read models from the other modules to produce valuation, allocation, result, return, and history. It does not decide whether a ledger mutation is valid.

A deliberately small shared domain contains only cross-module value concepts such as `UserId`, `Money`, `Currency`, `Quantity`, date-only values, and base domain errors.

Alternative considered: a separate SPA and API or service-per-module architecture. Rejected because it introduces duplicate contracts, deployments, authentication boundaries, and operational overhead without an MVP scaling need.

### 2. Organize Next.js routes separately from business modules

Recommended structure:

```text
src/
  app/                       # routes, layouts, loading/error states, composition
    (public)/
    (auth)/
    (product)/portfolios/[portfolioId]/
    auth/verify-email/
    auth/reset-password/
    api/auth/[...all]/
    api/health/
  modules/
    identity/
    portfolio/
    instruments/
    transactions/
    pricing/
    analytics/
  shared/
    domain/
    application/
    infrastructure/
  components/
    ui/
    layout/
  db/
    client/
    schema/
  config/
drizzle/                     # versioned SQL migrations
```

Each module may contain `domain`, `application`, `infrastructure`, and `interface` areas when it has code for them. Empty layers and one-file-per-class ceremony are not required. Module-local Drizzle schemas are aggregated by `db/schema`; migrations remain global because there is one database.

Server Components authenticate and call application queries directly, then render view models. They do not query Drizzle or calculate finance. Server Actions parse Zod input, resolve the actor, invoke one application command, map expected errors, and revalidate affected UI. Client Components are limited to interactive forms, charts, dialogs, and browser state. Internal reads do not call the application's own Route Handlers over HTTP.

### 3. Use Better Auth with one canonical Holdria user ID

Better Auth will provide self-hosted email/password authentication through its Drizzle PostgreSQL adapter. It is configured to use PostgreSQL UUID identifiers, and its generated user identifier is the canonical persisted user identifier for Holdria. Domain and application code wrap that UUID in a branded `UserId` and never import Better Auth models, clients, cookies, or request types.

There is no second application user, external-subject mapping, or identity-account table. Better Auth's user row is stored in Holdria's PostgreSQL database and is under the same migration and backup policy as portfolio data. If Holdria-specific profile fields are needed, a one-to-one `profiles` table uses the same `UserId`; credentials and security fields remain owned by Better Auth.

Better Auth is configured with:

- email/password enabled and verified email required for product access;
- database-backed sessions with secure, HTTP-only, same-site cookies;
- cookie session caching disabled initially so revocation and deletion take effect immediately;
- password hashing through Better Auth's supported secure default;
- verification, password reset, and account-security mail sent through a small SMTP-backed email port;
- trusted origins and an explicit public base URL;
- user deletion enabled with recent authentication or password confirmation.

Better Auth's generated Drizzle schema is checked into the repository, and Drizzle Kit produces the versioned SQL migration. Better Auth does not run an independent production migration mechanism.

Alternative considered: maintain a separate application user plus an authentication-account mapping. Rejected because Better Auth is self-hosted in the same database, exposes a stable user ID, and the MVP has one credential system. The mapping would duplicate identity lifecycle without adding current behavior.

Alternative considered: implement passwords, verification tokens, reset flows, and sessions directly. Rejected because this recreates high-risk security functionality already provided by a focused self-hosted library.

### 4. Keep PostgreSQL private and authorize through tenant-scoped use cases

Better Auth handles credentials and session validation inside the Next.js application. The browser communicates only with same-origin application and authentication routes; it never receives PostgreSQL credentials or connects to business tables.

- Better Auth tables are organized separately from Holdria business tables at the Drizzle schema level.
- PostgreSQL is reachable only from trusted application, migration, administration, and backup networks.
- A dedicated runtime database role receives only the DML privileges the application and Better Auth need.
- A separate migration connection owns DDL privileges.
- Route guards and layouts improve navigation but are not authorization controls.
- Every command and query resolves the current database-backed session and scopes access by canonical `UserId`.
- Repositories expose owned operations such as `findOwnedById(actorId, id)`, not unrestricted resource lookup to application callers.
- Tenant-owned child tables carry `owner_id`; composite foreign keys ensure their portfolio and instrument references belong to the same owner.
- Client-supplied owner identifiers are ignored or rejected.
- Destructive account operations require a fresh session, password, or valid one-time verification according to the identity spec.

PostgreSQL RLS is not required for the MVP because all data access passes through a trusted server and tenant-scoped repositories. This decision does not prohibit adding PostgreSQL-native RLS later as defense in depth, but correctness cannot depend on hidden session state in pooled database connections.

Cross-tenant integration tests will exercise read, update, delete, pricing, and analytics identifiers belonging to another user. Authentication tests cover expired and revoked sessions, cookie attributes in production configuration, email enumeration resistance, token expiry, and account deletion.

### 5. Use PostgreSQL source tables and derive financial state

Authoritative authentication tables are generated for Better Auth and include users, credential accounts, sessions, and verification records. Authoritative Holdria application tables are:

- optional `profiles` keyed by the Better Auth user ID
- `portfolios`
- `instruments`
- `instrument_external_references`
- `ledger_entries`
- `price_observations`

Every user-owned table references the Better Auth user row with `ON DELETE CASCADE`. Confirmed account deletion removes the canonical user inside PostgreSQL so credentials, sessions, verifications, profiles, portfolios, instruments, ledger entries, and prices are removed by one transactional database operation. Failure rolls back the deletion rather than leaving a partially usable account.

An optional lightweight operation-group identifier links atomic CONTRIBUTION and BUY entries; a separate group table is unnecessary unless later UX needs group metadata.

Derived data includes cash balances, positions, weighted-average cost, realized and unrealized results, portfolio valuation, allocation, Modified Dietz return, and historical points. There is no primary `positions` table.

`PortfolioSnapshot` is initially a domain/read-model value, not a persisted table. Analytics reconstructs requested historical points directly from ledger entries and price observations. Manual pricing produces a small input set, so this is simpler and sufficient. The calculation interface returns snapshot-shaped values so a cache table can be added transparently after query volume or measured latency justifies it.

Alternative considered: persist snapshots with source versions, invalidation ranges, and background rebuilds from the first increment. Rejected as premature because there are no automated daily prices, no queue, and initially few portfolios. Correct reconstruction is more important than cache management.

### 6. Model the ledger as a discriminated financial record

`ledger_entries` contains common identity, ownership, portfolio, effective date, stable sequence, optional group, type, currency, note, and audit fields. Type-specific nullable fields hold cash amount or trade instrument, quantity, unit price, and fee. PostgreSQL check constraints enforce the valid column combinations for each type.

All user-entered magnitudes are positive. Entry type determines accounting direction:

- CONTRIBUTION increases cash.
- WITHDRAWAL decreases cash.
- BUY increases units and decreases cash by quantity times unit price plus fee.
- SELL decreases units and increases cash by quantity times unit price minus fee.

Ledger order is `(effective_date, sequence)`. Sequence is immutable and allocated transactionally within a portfolio. An atomic "contribute and invest" command writes two independently valid linked entries in one PostgreSQL transaction, with CONTRIBUTION ordered before BUY.

Entries remain editable and deletable; this is not event sourcing. Every mutation replays the affected portfolio before commit. It is rejected if any point would have negative cash or instrument units. For the expected MVP data size, full portfolio replay is simpler and safer than incremental mutation logic.

### 7. Keep financial calculations pure and deterministic

PostgreSQL uses `numeric` for money, quantity, unit price, fees, percentages, and intermediate results. Drizzle numeric values remain strings at the persistence boundary and are converted into one decimal type, using `decimal.js`, before calculation. JavaScript `number` is never used for financial arithmetic.

Financial dates are date-only ISO values; audit timestamps use `timestamptz`. Calculators receive an explicit valuation date, ordered ledger, and selected price observations. They do not read the clock, database, environment, or "latest" global state.

Calculation stages are:

```text
ordered ledger
  -> accounting projection (cash, units, open cost, realized result)
  -> as-of price selection
  -> valuation (market value, unrealized result)
  -> analytics (allocation, absolute result, Modified Dietz, history)
```

Weighted-average cost includes purchase fees. A sale removes open cost using the existing average and records proceeds net of sale fees. This is a product performance method, not a Spanish tax calculation.

Precision is retained through calculations. Currency presentation rounds according to a centralized EUR display policy; calculation code does not scatter ad hoc rounding. Golden examples, edge cases, and invariant/property-oriented tests protect replay and return formulas.

### 8. Use Modified Dietz as the single primary portfolio return

The primary percentage is non-annualized Modified Dietz:

```text
(ending value - beginning value - sum(external cash flows))
----------------------------------------------------------------
(beginning value + sum(weight for each flow * external cash flow))
```

CONTRIBUTION is a positive external flow, WITHDRAWAL is negative, and BUY/SELL are internal. Since inception begins on the first contribution with zero beginning value. If required valuations are incomplete or the denominator is zero or negative, return is unavailable rather than zero.

The dashboard shows absolute result and one return percentage. It does not also promote `result / gross contributions`, avoiding two competing portfolio return concepts. Position-level unrealized percentage remains separately labelled and uses open cost as its denominator.

Alternative considered: simple result over gross contributions. Rejected as the primary metric because differently timed contributions can make it misleading. TWR and XIRR remain future capabilities.

### 9. Normalize manual and future external prices behind pricing ports

The MVP writes manual `price_observations` with instrument, positive decimal value, EUR currency, effective date, source, and ingestion timestamp. One manual observation exists per owned instrument and effective date. As-of selection returns the latest eligible observation on or before the valuation date together with actual date and provenance.

Pricing exposes capability-oriented ports:

- instrument search;
- latest price retrieval;
- historical price retrieval.

Provider-specific adapters translate responses into neutral candidate and price-point DTOs before application validation. Provider payload structures never enter instrument, transaction, portfolio, or analytics domain code. `instrument_external_references` associates an owned instrument with provider identifiers.

Future provider observations coexist with manual observations. Manual overrides and provider precedence will be explicit selection policy rather than destructive overwrites. The exact provider and scheduling mechanism are deferred.

### 10. Build a product UI around trust and explicit states

The authenticated shell prioritizes portfolio summary, operations, positions/allocation, prices, and history. A first-run empty state guides the user through portfolio creation, contribution, instrument creation, purchase, and price entry without presenting Holdria as a demo.

Server-rendered initial data and route-level loading boundaries improve perceived speed. Forms preserve safe input on validation errors, prevent accidental duplicate submission, and announce success or failure. Missing prices and incomplete valuations are visible states, never silently treated as zero. Financial values always include date and provenance where staleness matters.

Tailwind and shadcn/ui provide implementation primitives; Holdria-specific tokens, typography, color semantics, chart styling, copy, and responsive layouts provide the independent identity. Core workflows meet keyboard, focus, label, contrast, and status-announcement expectations.

### 11. Deploy as a portable, stateless Node.js container

Next.js uses its standalone Node.js output in a multi-stage Docker image. The container runs as a non-root user, binds to a configurable port, stores no durable state on its filesystem, and validates environment variables at startup.

Configuration includes `DATABASE_URL`, a migration database URL when privileges differ, `BETTER_AUTH_SECRET`, the public Better Auth/application URL, trusted origins, and standard SMTP connection settings. No managed-authentication variables or SDKs exist. Migrations run as an explicit release step, not from every application replica at startup. Health endpoints distinguish process liveness from PostgreSQL readiness.

The application uses a bounded PostgreSQL connection pool appropriate to a persistent Node.js container. PostgreSQL runs as a separately backed-up service or container on operator-controlled infrastructure; its data directory is not part of the stateless application container. TLS termination and trusted proxy headers are configured explicitly at the reverse proxy. No application feature depends on Vercel-specific storage, cron, runtime, or APIs.

The exact host, PostgreSQL topology, SMTP server, reverse proxy, backup target, and observability implementation are deployment decisions. Standard protocols and environment configuration keep each replaceable, and all can be self-hosted.

### 12. Test by architectural risk

Vitest covers pure domain calculations, ledger replay, Modified Dietz, as-of pricing, and application authorization behavior. Database integration tests cover Better Auth's Drizzle schema, session resolution, application constraints, transactions, ownership joins, account deletion cascades, and atomic contribute-and-invest behavior against PostgreSQL. Playwright covers registration, email verification with a test mail transport, login/logout, recovery, password change, deletion, and the critical journey from empty account to valued portfolio.

Tests must include accessibility assertions for core flows, responsive viewport coverage, designed empty/error states, cross-tenant attempts, and secure-cookie production configuration. Pricing provider adapters will use contract tests when introduced.

## Risks / Trade-offs

- [Better Auth upgrade changes its generated schema or behavior] -> Pin versions, review changelogs, regenerate schema intentionally, and apply all changes through reviewed Drizzle migrations.
- [Self-hosted PostgreSQL loses data or becomes unavailable] -> Automate encrypted backups, test restoration, monitor storage and connections, and document upgrade and recovery procedures before public launch.
- [Authentication email is delayed or rejected] -> Use standard SMTP with observable delivery failures, verified sender configuration, generic UI responses, and retry-safe token flows.
- [Session or cookie misconfiguration weakens authentication] -> Use HTTPS, explicit base URL and trusted origins, production secure/HTTP-only/same-site cookies, database-backed revocable sessions, and security integration tests.
- [Application authorization bug exposes tenant data] -> Use private schemas, least-privilege roles, owner-scoped repository interfaces, composite ownership constraints, and adversarial cross-tenant tests.
- [Full ledger replay becomes slow] -> Keep replay pure and measured; add checkpoints or persisted projections only after profiling demonstrates the need.
- [On-demand historical reconstruction becomes slow] -> Return snapshot-shaped read models now and add a reconstructible snapshot cache later without changing source tables or user behavior.
- [Manual prices are stale or incomplete] -> Always expose price dates and provenance, and suppress complete valuation or return when required inputs are missing.
- [Modified Dietz is unfamiliar] -> Present one clearly labelled return, provide concise explanatory copy, and never silently substitute another formula.
- [Single flattened ledger table has nullable fields] -> Use a discriminated domain union plus database check constraints and type-specific validation.
- [EUR-only validation leaks into permanent design] -> Retain currency fields and centralize the temporary EUR policy in application rules.
- [Single-server infrastructure reaches capacity] -> Keep the application stateless, PostgreSQL external to the app container, and runtime configuration portable so replicas or a larger database host can be introduced without changing domain code.

## Migration Plan

There is no existing product data to migrate.

1. Establish the application skeleton, environment validation, self-hosted PostgreSQL development setup, test SMTP transport, and CI quality gates.
2. Generate the Better Auth Drizzle schema, add Holdria business schemas, and produce one reviewed initial SQL migration.
3. Apply the migration using a migration-specific database connection and verify authentication plus ownership constraints.
4. Configure the public base URL, trusted origins, HTTPS reverse proxy, production SMTP, backup automation, and restore procedure before public launch.
5. Build and verify the standalone application Docker image and the operator-controlled deployment topology in CI or staging.
6. Deploy to staging, run migrations as a release step, and execute authentication, deletion, smoke, accessibility, and cross-tenant tests before production deployment.

Rollback before real user data exists can remove the deployment and initial schema. After public data exists, application rollback uses the prior compatible image; schema changes must follow forward-compatible expand/contract migrations and must not discard ledger or price source data.

## Open Questions

- Which self-hosted SMTP, reverse proxy, backup target, and error-monitoring implementations will be configured before public launch?
- Which external price provider or provider combination will be evaluated in the first post-MVP pricing change?
