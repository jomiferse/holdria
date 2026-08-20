# Manual Prices Specification

## Purpose

Captures dated manual market prices in a provider-neutral form so Holdria can value investments now and adopt automated price sources later.

## Requirements

### Requirement: Record manual price observations
The system SHALL allow an instrument owner to record, edit, and delete a positive EUR price observation for a specific effective date.

#### Scenario: User records a manual price
- **WHEN** the owner submits a positive EUR price and effective date for an owned instrument
- **THEN** the system stores the observation with its manual source and ingestion time

#### Scenario: User submits an invalid price
- **WHEN** a user submits a zero, negative, non-EUR, or malformed price observation
- **THEN** the system rejects the observation without affecting existing prices

#### Scenario: User edits a price
- **WHEN** the owner corrects an existing manual price observation
- **THEN** subsequent current and historical valuations use the corrected observation

### Requirement: One manual price per instrument date
The system SHALL maintain at most one manual price observation for a user's instrument on a given effective date.

#### Scenario: Price already exists for the date
- **WHEN** the owner attempts to create another manual price for the same instrument and effective date
- **THEN** the system prevents an ambiguous duplicate and directs the owner to edit the existing observation

### Requirement: Deterministic as-of price selection
The system SHALL select the most recent eligible observation whose effective date is on or before the requested valuation date and SHALL return the price together with its date and source.

#### Scenario: Exact-date price exists
- **WHEN** a valuation requests a date with an eligible observation
- **THEN** the system selects that observation

#### Scenario: Only an earlier price exists
- **WHEN** a valuation requests a date without an exact observation but an earlier eligible observation exists
- **THEN** the system selects the latest earlier observation and preserves its actual effective date

#### Scenario: No eligible price exists
- **WHEN** no observation exists on or before the requested valuation date
- **THEN** the system reports the instrument as unpriced rather than assuming a value

### Requirement: Price provenance is visible
The system SHALL make the effective date and source of a selected price available wherever the age or origin of that price affects user trust.

#### Scenario: Valuation uses an older manual price
- **WHEN** a current valuation carries forward a price from an earlier date
- **THEN** the system communicates the price date and does not represent it as real-time data
