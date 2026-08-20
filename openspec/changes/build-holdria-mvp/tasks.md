## 1. Application Foundation

- [x] 1.1 Scaffold the Next.js App Router TypeScript application with Better Auth, its Drizzle PostgreSQL adapter, the agreed product dependencies, and package scripts for development, build, lint, type checking, and tests.
- [x] 1.2 Create the route groups, module directories, shared domain areas, database aggregation area, and composition boundaries described in the design.
- [x] 1.3 Add typed environment validation for runtime and migration database URLs, Better Auth URL and secret, trusted origins, SMTP settings, and optional observability settings without exposing server secrets to the browser.
- [x] 1.4 Configure Tailwind CSS and shadcn/ui with initial Holdria design tokens, typography, financial status colors, focus styles, and responsive layout primitives.
- [ ] 1.5 Configure Vitest and Playwright, including PostgreSQL integration-test support and reusable authenticated-user fixtures that do not depend on production accounts.

## 2. PostgreSQL and Drizzle Foundation

- [x] 2.1 Configure Drizzle for self-hosted PostgreSQL, separate runtime and migration privileges, bounded connection pooling, PostgreSQL numeric handling, and versioned SQL migrations.
- [x] 2.2 Configure Better Auth to generate PostgreSQL UUID identifiers, generate and review its Drizzle user, account, session, and verification schema, and keep Drizzle migrations as the only production migration path.
- [x] 2.3 Define optional Holdria profiles plus the `portfolios`, `instruments`, `instrument_external_references`, `ledger_entries`, and `price_observations` tables with UUIDs, audit fields, indexes, and ownership columns.
- [x] 2.4 Add database constraints for EUR currency, instrument identity uniqueness, manual-price uniqueness, ledger type-specific fields, positive magnitudes, and stable per-portfolio sequence values.
- [x] 2.5 Add composite ownership keys and foreign keys that prevent cross-user relationships and cascade every user's Holdria data from deletion of the canonical Better Auth user row.
- [x] 2.6 Create least-privilege runtime and migration roles and document network rules that keep PostgreSQL reachable only from trusted application, migration, administration, and backup paths.
- [x] 2.7 Generate and verify the combined Better Auth and Holdria SQL migration against a clean PostgreSQL database, including critical constraints, cascades, and transaction rollback.

## 3. Identity and Authorization

- [x] 3.1 Configure the same-origin Better Auth Next.js handler with its Drizzle adapter, email/password authentication, required email verification, UUID IDs, database-backed sessions, and user deletion enabled.
- [ ] 3.2 Configure production cookie, session expiry, revocation, trusted-origin, CSRF, password-hashing, and authentication rate-limit settings without Redis or stateless-session mode.
- [ ] 3.3 Implement a provider-neutral email port with an SMTP adapter for verification, password reset, and account-security messages, including test transport and generic anti-enumeration responses.
- [ ] 3.4 Implement the authenticated actor abstraction that converts the Better Auth user UUID into the domain `UserId` without exposing Better Auth types outside identity infrastructure.
- [ ] 3.5 Build accessible registration, verification-pending, sign-in, sign-out, recovery, password-reset, authenticated password-change, and permanent account-deletion experiences.
- [ ] 3.6 Implement account deletion confirmation and ensure one failed operation cannot leave credentials, sessions, or Holdria-owned data partially deleted.
- [ ] 3.7 Add authenticated route protection for navigation and enforce verified-user authorization again inside every command and query entry point.
- [ ] 3.8 Add tests for verification, neutral recovery responses, password reset and change, secure cookies, session expiry and revocation, deletion cascades, ignored owner identifiers, and cross-tenant denial.

## 4. Portfolio Management and Product Shell

- [x] 4.1 Implement the portfolio domain rules, owner-scoped repository, and application commands and queries for list, create, rename, and confirmed deletion.
- [x] 4.2 Implement Zod inputs and Server Actions for portfolio mutations, including EUR-only enforcement and expected-error mapping.
- [x] 4.3 Build the authenticated responsive shell with portfolio switching and navigation for summary, operations, prices, allocation, and history.
- [x] 4.4 Build the no-portfolio onboarding state and portfolio create, rename, and delete flows with accessible confirmation and feedback.
- [x] 4.5 Add unit, repository, and Playwright coverage for multiple portfolios, EUR rejection, ownership, empty states, and lifecycle actions.

## 5. Instrument Management

- [x] 5.1 Implement instrument domain types and validation for FUND, ETF, and STOCK, including canonical ISIN normalization and validation.
- [x] 5.2 Implement the owner-scoped instrument repository and commands and queries for creation, listing, editing, and safe deletion.
- [x] 5.3 Enforce required ISIN for funds, per-user ISIN uniqueness, ticker-plus-market semantics for exchange-traded instruments, EUR-only use, and protection of referenced instruments.
- [x] 5.4 Build responsive instrument list and form experiences with type-aware fields, validation feedback, empty states, and clear referenced-instrument deletion errors.
- [x] 5.5 Add domain, database integration, authorization, and UI tests for all supported instrument types and identifier rules.

## 6. Ledger and Accounting Projection

- [ ] 6.1 Implement precise shared financial value objects using `decimal.js`, validated date-only values, centralized EUR formatting, and no JavaScript-number calculation paths.
- [ ] 6.2 Implement CONTRIBUTION, WITHDRAWAL, BUY, and SELL as a discriminated ledger domain model with type-specific invariants and fee handling.
- [ ] 6.3 Implement the deterministic ledger reducer for cash, units, weighted-average open cost, and realized result ordered by effective date and immutable sequence.
- [ ] 6.4 Implement owner-scoped ledger persistence with concurrency-safe sequence allocation and transactional replay validation for create, edit, and delete.
- [ ] 6.5 Implement the atomic contribute-and-invest command that persists linked CONTRIBUTION and BUY entries in the required order or rolls both back.
- [ ] 6.6 Build ledger list, add, edit, delete, and contribute-and-invest forms with type-aware fields and explanations for negative-cash, negative-units, and backdated conflicts.
- [ ] 6.7 Add golden, edge-case, and invariant-oriented tests for fees, multiple buys, partial and full sales, same-date ordering, corrections, and failed atomic groups.

## 7. Manual Pricing and Provider Boundary

- [ ] 7.1 Implement the price-observation domain model, owner-scoped repository, and create, edit, delete, and list use cases for dated positive EUR manual prices.
- [ ] 7.2 Implement deterministic as-of price selection that returns value, effective date, source, and an explicit unpriced result.
- [ ] 7.3 Define provider-neutral application ports and DTOs for instrument search, latest prices, and price history, plus instrument external-reference persistence, without adding a real provider.
- [ ] 7.4 Build manual-price list and edit experiences that expose effective date and source, prevent ambiguous same-date duplicates, and never label manual data as real-time.
- [ ] 7.5 Add domain, persistence, authorization, and UI tests for price validation, duplicate dates, corrections, deletion, provenance, and as-of selection.

## 8. Portfolio Analytics

- [ ] 8.1 Implement current position and portfolio valuation by combining the ledger projection with owner-scoped as-of price observations.
- [ ] 8.2 Implement open-cost, realized and unrealized result, and total absolute result calculations with explicit incomplete-valuation outcomes.
- [ ] 8.3 Implement non-annualized Modified Dietz for arbitrary supported periods and since inception, including unavailable results for missing inputs or non-positive denominators.
- [ ] 8.4 Implement allocation by instrument and instrument type with explicit incomplete states when any required price is unavailable.
- [ ] 8.5 Implement on-demand historical reconstruction that returns in-memory `PortfolioSnapshot` values only for complete valuation dates and persists no snapshot cache.
- [ ] 8.6 Build the portfolio summary, positions, allocation chart, return explanation, missing-price state, and historical evolution chart with responsive and accessible presentations.
- [ ] 8.7 Add deterministic calculation tests using known financial examples and repeated-input checks for valuation, absolute result, Modified Dietz, allocation, and reconstructed history.

## 9. Integrated Product Quality

- [ ] 9.1 Complete the first-run journey from self-hosted account registration and verification through portfolio, contribution, instrument, purchase, manual price, and first complete valuation.
- [ ] 9.2 Add intentional route and component loading, empty, error, and success states across every core workflow, preserving safe form input after expected failures.
- [ ] 9.3 Audit and correct keyboard navigation, focus management, labels, announcements, contrast, chart alternatives, and narrow-viewport behavior for core pages.
- [ ] 9.4 Add structured error handling and privacy-safe logging that excludes credentials, tokens, portfolio values, ledger amounts, and unnecessary personal data.
- [ ] 9.5 Add end-to-end journeys for a valued fund portfolio, an ETF or stock portfolio, contribution and withdrawal flows, partial sale, missing price, correction, and cross-tenant denial.

## 10. Portable Build and Release Readiness

- [x] 10.1 Configure Next.js standalone Node.js output and create a multi-stage Docker image that runs as non-root with no durable filesystem dependency.
- [x] 10.2 Add a reference Docker Compose deployment for the application and persistent PostgreSQL, plus a development/test SMTP service, without coupling production to Compose.
- [x] 10.3 Add liveness and PostgreSQL-readiness endpoints, graceful connection-pool shutdown, and documented runtime versus migration database roles.
- [ ] 10.4 Add a release workflow that runs checks, builds the application and Docker image, and executes reviewed Drizzle migrations as an explicit step rather than at replica startup.
- [ ] 10.5 Document local, test, staging, and production configuration for Better Auth secrets, trusted origins, HTTPS proxying, SMTP, PostgreSQL backup and restore, migration, and optional observability.
- [ ] 10.6 Verify a clean operator-controlled Docker deployment with PostgreSQL and Better Auth, then run migration, authentication, deletion, smoke, accessibility, and tenant-isolation checks.
