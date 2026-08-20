# Investment Ledger Specification

## Purpose

Records the authoritative cash and investment activity for each portfolio so all balances, positions, and results can be derived reproducibly.

## Requirements

### Requirement: Separate ledger entry types
The system SHALL record CONTRIBUTION, WITHDRAWAL, BUY, and SELL as distinct ledger entries with positive input magnitudes whose accounting direction is determined by the entry type.

#### Scenario: User records a contribution
- **WHEN** the owner records a positive EUR contribution on an effective date
- **THEN** the system adds a CONTRIBUTION entry that increases portfolio cash

#### Scenario: User records a withdrawal
- **WHEN** the owner records a valid positive EUR withdrawal on an effective date
- **THEN** the system adds a WITHDRAWAL entry that decreases portfolio cash

#### Scenario: User records a buy
- **WHEN** the owner records a BUY with a valid owned instrument, positive quantity, positive unit price, effective date, and optional non-negative fee
- **THEN** the system adds a BUY entry that increases units and decreases cash by purchase cost plus fee

#### Scenario: User records a sell
- **WHEN** the owner records a SELL with a valid owned instrument, positive quantity, positive unit price, effective date, and optional non-negative fee
- **THEN** the system adds a SELL entry that decreases units and increases cash by sale proceeds minus fee

### Requirement: Type-specific entry validation
The system MUST require only the financial fields applicable to each ledger type and MUST reject zero, negative, contradictory, or unsupported values.

#### Scenario: Cash entry contains trade fields
- **WHEN** a contribution or withdrawal includes an instrument, quantity, or unit price
- **THEN** the system rejects the entry without changing the ledger

#### Scenario: Trade entry lacks required fields
- **WHEN** a buy or sell lacks its instrument, quantity, unit price, or effective date
- **THEN** the system rejects the entry and identifies the missing fields

### Requirement: Ledger invariants
The system MUST replay the affected portfolio ledger in deterministic effective order before accepting a mutation and MUST reject any result that produces negative cash or negative instrument units at any point.

#### Scenario: Buy exceeds available cash
- **WHEN** a buy would make portfolio cash negative at its effective position in the ledger
- **THEN** the system rejects the buy and leaves the ledger unchanged

#### Scenario: Sell exceeds available units
- **WHEN** a sell would make the held quantity negative at its effective position in the ledger
- **THEN** the system rejects the sell and leaves the ledger unchanged

#### Scenario: Backdated edit invalidates later state
- **WHEN** an edited or inserted historical entry would make any later cash or position state invalid
- **THEN** the system rejects the mutation and identifies that it conflicts with subsequent operations

### Requirement: Atomic contribute and invest workflow
The system SHALL offer a combined workflow that creates a CONTRIBUTION followed by a BUY as separate linked entries within one atomic operation.

#### Scenario: Combined workflow succeeds
- **WHEN** the owner submits a valid contribution and buy combination
- **THEN** both entries are committed, linked, and ordered with the contribution before the buy

#### Scenario: Combined workflow fails
- **WHEN** either entry in a combined contribution and buy is invalid or cannot be persisted
- **THEN** neither entry is added to the ledger

### Requirement: Correct ledger mistakes
The system SHALL allow the owner to edit or delete an entry and SHALL recalculate the affected portfolio before committing the correction.

#### Scenario: User edits an entry validly
- **WHEN** an owner submits a valid correction that preserves all ledger invariants
- **THEN** the system updates the entry and all subsequent derived results reflect the correction

#### Scenario: User deletes a required earlier entry
- **WHEN** deleting an entry would cause a later cash or unit balance to become negative
- **THEN** the system rejects the deletion and preserves the existing ledger

### Requirement: Deterministic entry order
The system SHALL assign each ledger entry a stable order and SHALL derive portfolio state using effective date followed by that stable order.

#### Scenario: Multiple entries share an effective date
- **WHEN** two or more entries have the same effective date
- **THEN** repeated calculations process them in the same stable order and produce the same result
