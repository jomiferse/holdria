## Purpose

Provides reusable user-owned definitions for funds, ETFs, and stocks with identifiers and currency rules suitable for reliable pricing and portfolio tracking.

## ADDED Requirements

### Requirement: Supported instrument types
The system SHALL allow an authenticated user to create instruments of type FUND, ETF, or STOCK and SHALL store the type independently from portfolio operations.

#### Scenario: User creates a supported instrument
- **WHEN** a user submits valid metadata for a fund, ETF, or stock
- **THEN** the system creates a reusable instrument owned by that user

#### Scenario: User submits an unsupported type
- **WHEN** a user attempts to create an instrument type outside the MVP set
- **THEN** the system rejects the request without creating a partial instrument

### Requirement: ISIN is first-class
The system SHALL store and normalize ISIN independently from display names and ticker symbols, and SHALL require a valid ISIN for every fund.

#### Scenario: User creates a fund with an ISIN
- **WHEN** a user submits a fund with a structurally valid ISIN containing lowercase letters or spaces
- **THEN** the system normalizes the ISIN to its canonical uppercase form and stores the fund

#### Scenario: User creates a fund without a valid ISIN
- **WHEN** a user submits a fund with a missing or invalid ISIN
- **THEN** the system rejects the instrument and identifies the invalid field

#### Scenario: User repeats an owned ISIN
- **WHEN** a user attempts to create another instrument with an ISIN already used by one of their instruments
- **THEN** the system rejects the duplicate and directs the user to the existing instrument

### Requirement: Market identifiers for exchange-traded instruments
The system SHALL support ticker and market identifier metadata for ETFs and stocks and SHALL NOT treat a ticker alone as globally unique.

#### Scenario: User creates an exchange-traded instrument
- **WHEN** a user submits an ETF or stock with valid identifying metadata
- **THEN** the system stores its ticker and market identifier when provided, independently from its ISIN

### Requirement: EUR instrument restriction
The system SHALL retain an instrument currency and SHALL restrict all instruments usable in MVP portfolios to EUR.

#### Scenario: User creates a EUR instrument
- **WHEN** a user submits a valid instrument denominated in EUR
- **THEN** the system permits the instrument to be used in their portfolios

#### Scenario: User submits a non-EUR instrument
- **WHEN** a user attempts to create or use a non-EUR instrument
- **THEN** the system rejects the request and explains that FX conversion is not supported

### Requirement: Protect referenced instruments
The system SHALL prevent removal of an instrument while it is referenced by ledger entries or price observations unless the dependent data is removed through an explicit supported workflow.

#### Scenario: User deletes an unused instrument
- **WHEN** the owner deletes an instrument with no dependent data
- **THEN** the system removes the instrument

#### Scenario: User deletes a referenced instrument
- **WHEN** the owner attempts to delete an instrument referenced by an operation or price
- **THEN** the system preserves the instrument and explains the dependency
