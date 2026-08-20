# User Access Specification

## Purpose

Provides secure public access to Holdria while ensuring every authenticated user can reach only their own investment data.

## Requirements

### Requirement: Public email registration
The system SHALL allow a visitor to register with an email address and password and SHALL require email verification before granting access to authenticated product features.

#### Scenario: Successful registration
- **WHEN** a visitor submits a valid unused email address and an acceptable password
- **THEN** the system creates the authentication account, sends a verification message, and explains that verification is required

#### Scenario: Unverified account attempts product access
- **WHEN** a registered user has not verified their email and attempts to access an authenticated product page
- **THEN** the system denies product access and presents a path to complete verification

### Requirement: Secure session access
The system SHALL allow a verified user to sign in and sign out using a revocable server-side session represented by a secure, HTTP-only, same-site cookie.

#### Scenario: Verified user signs in
- **WHEN** a verified user submits valid credentials
- **THEN** the system establishes a database-backed session, issues the session cookie, and takes the user to the authenticated product

#### Scenario: User signs out
- **WHEN** an authenticated user requests sign-out
- **THEN** the system revokes the current session, clears its cookie, and prevents further access to authenticated pages

#### Scenario: Revoked or expired session is presented
- **WHEN** a request presents a session that is expired, revoked, or otherwise invalid
- **THEN** the system denies authenticated access and requires the user to sign in again

### Requirement: Password lifecycle
The system SHALL allow password recovery by email and authenticated password change, and SHALL avoid disclosing whether an arbitrary recovery email address is registered.

#### Scenario: Visitor requests password recovery
- **WHEN** a visitor submits an email address to the password recovery flow
- **THEN** the system returns a neutral confirmation and sends a time-limited recovery link when the account is eligible

#### Scenario: User resets a forgotten password
- **WHEN** a user submits a valid unexpired recovery token and an acceptable new password
- **THEN** the system replaces the password and prevents reuse of the recovery token

#### Scenario: Authenticated user changes password
- **WHEN** an authenticated user proves knowledge of the current password and submits an acceptable new password
- **THEN** the system changes the password and preserves only sessions allowed by the configured security policy

### Requirement: Account deletion
The system SHALL allow an authenticated user to permanently delete their account after a security confirmation and SHALL remove their authentication records and all owned Holdria data without leaving a usable session.

#### Scenario: User confirms account deletion
- **WHEN** an authenticated user with a sufficiently fresh session or valid password confirms permanent account deletion
- **THEN** the system deletes the user, cascades deletion to their portfolios, instruments, ledger entries, prices, sessions, and credentials, and signs the user out

#### Scenario: Account deletion lacks security confirmation
- **WHEN** a user requests account deletion without the required fresh authentication, password, or valid verification token
- **THEN** the system rejects deletion and preserves the account and its data

#### Scenario: Account deletion cannot complete
- **WHEN** any required part of account deletion fails
- **THEN** the system does not leave a partially deleted usable account and communicates that deletion was not completed

### Requirement: Tenant-isolated access
The system MUST authorize every portfolio, instrument, ledger, pricing, and analytics operation against the authenticated Holdria user and MUST NOT trust an owner identifier supplied by the client.

#### Scenario: User accesses owned data
- **WHEN** an authenticated user requests a resource they own
- **THEN** the system permits the operation subject to that capability's rules

#### Scenario: User requests another user's resource
- **WHEN** an authenticated user submits or guesses an identifier belonging to another user
- **THEN** the system reveals no private data and rejects the operation

### Requirement: Accessible authentication feedback
The system SHALL present authentication and account-security progress, validation failures, service errors, destructive confirmations, and successful outcomes in an accessible and understandable form.

#### Scenario: Authentication request is in progress
- **WHEN** a registration, sign-in, verification, recovery, password change, or account deletion request is pending
- **THEN** the system communicates progress and prevents accidental duplicate submission

#### Scenario: Authentication request fails
- **WHEN** an authentication request cannot be completed
- **THEN** the system preserves safe user input and presents an actionable error without exposing sensitive details
