# Portfolio Analytics Specification

## Purpose

Derives transparent and reproducible portfolio positions, valuations, allocation, results, return, and history from ledger entries and price observations.

## Requirements

### Requirement: Derive accounting state from the ledger
The system SHALL derive portfolio cash, instrument units, weighted-average open cost, realized result, and unrealized result from the complete deterministically ordered ledger.

#### Scenario: Portfolio contains multiple buys
- **WHEN** a portfolio contains valid buys of the same instrument at different prices
- **THEN** the system derives its open cost using weighted-average cost including purchase fees

#### Scenario: Portfolio contains a partial sale
- **WHEN** a valid sell disposes of part of an instrument position
- **THEN** the system reduces units and open cost at the existing weighted-average cost and derives realized result net of sale fees

### Requirement: Current portfolio valuation
The system SHALL calculate portfolio value as cash plus the value of each open position using the selected as-of price for that instrument.

#### Scenario: All open positions have prices
- **WHEN** every open position has an eligible price for the valuation date
- **THEN** the system returns a complete value with cash, position values, total value, and the dates of the prices used

#### Scenario: An open position lacks a price
- **WHEN** one or more open positions have no eligible price
- **THEN** the system identifies the unpriced positions and does not present an incomplete total as a complete portfolio value

### Requirement: Absolute portfolio result
The system SHALL calculate total absolute result as current portfolio value plus cumulative withdrawals minus cumulative contributions.

#### Scenario: Portfolio has contributions and withdrawals
- **WHEN** a complete current valuation is available
- **THEN** the displayed absolute result includes external money already withdrawn and excludes internal buys and sells as external flows

### Requirement: Modified Dietz return
The system SHALL use non-annualized Modified Dietz as the primary portfolio percentage return, treating contributions as positive external flows, withdrawals as negative external flows, and BUY and SELL as internal movements.

#### Scenario: Cash flows occur at different dates
- **WHEN** a complete start and end valuation and dated external flows are available for the selected period
- **THEN** the system weights each external flow by the fraction of the period it was invested and returns the Modified Dietz result

#### Scenario: Return is requested since inception
- **WHEN** the portfolio has a first contribution and a complete ending valuation
- **THEN** the period begins on the first contribution date with a zero beginning value and the system calculates a non-annualized since-inception return

#### Scenario: Return cannot be calculated reliably
- **WHEN** required valuation data is missing or the Modified Dietz denominator is zero or negative
- **THEN** the system marks return as unavailable and explains the reason instead of displaying zero or a misleading percentage

### Requirement: Portfolio allocation
The system SHALL derive allocation from current position values and SHALL support distribution by instrument and supported instrument type.

#### Scenario: Portfolio has multiple valued positions
- **WHEN** all relevant position values are available
- **THEN** the system shows each position and instrument type as a proportion of invested market value

#### Scenario: Allocation is incomplete
- **WHEN** a position lacks an eligible price
- **THEN** the system marks the allocation as incomplete and identifies the missing valuation input

### Requirement: Historical evolution
The system SHALL provide reconstructible historical portfolio values from ledger entries and dated prices without requiring a daily value for dates that lack sufficient inputs.

#### Scenario: Historical dates have complete price coverage
- **WHEN** the ledger and as-of price observations can value all open positions on historical dates
- **THEN** the system presents a chronological series of complete portfolio values for those dates

#### Scenario: Early history lacks a price
- **WHEN** an open instrument has no eligible price for an earlier date
- **THEN** the system omits or clearly marks that incomplete point and does not fabricate a historical value

#### Scenario: Source data is corrected
- **WHEN** an earlier ledger entry or price observation is edited or deleted
- **THEN** subsequent historical results are rebuilt from the corrected source data

### Requirement: Financial outputs remain reproducible
The system MUST produce the same financial outputs for the same ordered ledger, price observations, valuation date, and calculation rules.

#### Scenario: Analytics are recalculated
- **WHEN** analytics are calculated repeatedly with identical inputs
- **THEN** cash, positions, costs, results, allocation, return, and history are identical
