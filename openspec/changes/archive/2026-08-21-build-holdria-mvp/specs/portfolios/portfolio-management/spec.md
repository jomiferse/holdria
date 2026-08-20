## Purpose

Lets each Holdria user organize investments into one or more private EUR portfolios through a clear and trustworthy product experience.

## ADDED Requirements

### Requirement: Manage multiple portfolios
The system SHALL allow an authenticated user to create, view, rename, and delete multiple portfolios that they own.

#### Scenario: User creates a portfolio
- **WHEN** an authenticated user submits a valid portfolio name
- **THEN** the system creates an empty portfolio owned by that user with EUR as its base currency

#### Scenario: User renames a portfolio
- **WHEN** the owner submits a valid new name for a portfolio
- **THEN** the system updates the name without changing the portfolio's ledger or analytics

#### Scenario: User deletes a portfolio
- **WHEN** the owner confirms deletion of a portfolio
- **THEN** the system removes the portfolio and its owned operational data without affecting other portfolios

### Requirement: EUR-only functional scope
The system SHALL retain a currency on each portfolio and SHALL restrict every MVP portfolio to EUR as its base currency.

#### Scenario: Portfolio is created
- **WHEN** a user creates a portfolio during the MVP
- **THEN** its base currency is EUR

#### Scenario: Unsupported base currency is requested
- **WHEN** a client attempts to create or change a portfolio to a non-EUR base currency
- **THEN** the system rejects the request with an explanation that only EUR is currently supported

### Requirement: Product navigation and onboarding
The system SHALL provide clear navigation between a user's portfolios and the major portfolio areas, and SHALL guide a new user toward the first useful actions.

#### Scenario: New user has no portfolios
- **WHEN** an authenticated user has not created a portfolio
- **THEN** the system presents an intentional empty state with a clear action to create the first portfolio

#### Scenario: User opens a portfolio
- **WHEN** a user selects an owned portfolio
- **THEN** the system provides clear access to its summary, operations, instruments or prices, allocation, and history

### Requirement: Responsive and accessible portfolio experience
The authenticated product SHALL remain usable on supported mobile and desktop viewport sizes and SHALL expose meaningful labels, focus behavior, status announcements, and keyboard interaction for core workflows.

#### Scenario: User accesses Holdria on a narrow viewport
- **WHEN** a user opens an authenticated page on a mobile-sized viewport
- **THEN** the primary information and actions remain readable and operable without horizontal page scrolling

#### Scenario: Portfolio content is loading or unavailable
- **WHEN** portfolio data is loading, empty, successfully changed, or fails to load
- **THEN** the system shows a designed state that communicates the current condition and the next available action
