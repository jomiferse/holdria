## Why

Holdria needs a trustworthy, publicly deployable MVP that lets individuals track investment portfolios without spreadsheets or broker integrations. The first release should make manual portfolio tracking useful for funds, ETFs, and stocks while establishing clean boundaries for automated pricing and future product growth.

## What Changes

- Introduce self-hosted public user registration, email verification, sign-in, sign-out, password recovery and change, account deletion, and tenant-isolated access through Better Auth backed by Holdria's PostgreSQL database.
- Let each user create and manage one or more EUR-denominated portfolios.
- Let users define EUR-denominated funds, ETFs, and stocks, with ISIN as a first-class identifier and required for funds.
- Introduce a cash-aware ledger with separate CONTRIBUTION, WITHDRAWAL, BUY, and SELL entries, including an atomic "contribute and invest" workflow.
- Derive cash, positions, weighted-average cost, realized and unrealized result, and current portfolio value from the ledger and dated prices.
- Let users record dated manual prices and use them to produce current and historical valuations.
- Show portfolio allocation, absolute result, and Modified Dietz return with explicit handling of missing or insufficient data.
- Deliver a responsive, accessible product experience with clear onboarding and intentional loading, empty, error, and success states.
- Establish a modular Next.js architecture, portable Docker deployment, and provider-neutral pricing boundary without implementing external price providers in this change.

## Capabilities

### New Capabilities

- `identity/user-access`: Public registration, verification, authentication, password lifecycle, account deletion, internal user identity, and tenant-isolated access.
- `portfolios/portfolio-management`: Creation and lifecycle management of user-owned, EUR-denominated portfolios.
- `instruments/instrument-management`: User-owned funds, ETFs, and stocks with validated identifiers and EUR restrictions.
- `transactions/investment-ledger`: Cash-aware recording and validation of contributions, withdrawals, buys, and sells.
- `pricing/manual-prices`: Dated manual price observations and deterministic as-of price selection.
- `analytics/portfolio-analytics`: Derived positions, valuation, allocation, result, Modified Dietz return, and reconstructible history.

### Modified Capabilities

None. Holdria has no existing product capabilities.

## Impact

- Creates the initial Holdria web application and its domain model.
- Introduces Next.js App Router, TypeScript, Tailwind CSS, shadcn/ui, Zod, Recharts, Drizzle, self-hosted PostgreSQL, Better Auth, Vitest, and Playwright.
- Adds versioned PostgreSQL migrations and private server-side access to business tables.
- Stores authentication users, credentials, verifications, and sessions in Holdria's own PostgreSQL database through the Better Auth Drizzle adapter.
- Adds a portable Docker runtime with environment-based configuration and no required Vercel services.
- Requires a configurable, self-hostable SMTP service for verification, recovery, and account-security email delivery without coupling runtime code to a managed authentication platform.
- Does not add payments, broker imports, external price providers, FX conversion, tax reporting, dividends, corporate actions, or a separate public API.
