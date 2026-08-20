/**
 * Base domain error types shared across modules.
 *
 * Modules throw these (or subclasses) from domain and application code so
 * that Server Actions and Route Handlers can map expected failures to
 * accessible, non-leaking user feedback without inspecting error strings.
 *
 * Keep this file limited to cross-module error shapes. Module-specific
 * error subclasses belong in that module's own `domain` area.
 */

/** Base class for all expected (non-bug) domain and application failures. */
export abstract class DomainError extends Error {
  abstract readonly code: string;

  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = new.target.name;
  }
}

/** The requested resource does not exist, or the actor is not its owner. */
export class NotFoundError extends DomainError {
  readonly code = "NOT_FOUND";
}

/** Input failed validation before reaching persistence. */
export class ValidationError extends DomainError {
  readonly code = "VALIDATION_ERROR";

  constructor(
    message: string,
    readonly fieldErrors: Record<string, string[]> = {},
  ) {
    super(message);
  }
}

/** The actor is not authenticated or not authorized for this operation. */
export class UnauthorizedError extends DomainError {
  readonly code = "UNAUTHORIZED";
}

/** The operation conflicts with an existing record (e.g. a duplicate). */
export class ConflictError extends DomainError {
  readonly code = "CONFLICT";
}

/** The operation would violate a domain invariant (e.g. negative cash). */
export class InvariantViolationError extends DomainError {
  readonly code = "INVARIANT_VIOLATION";
}

/** The actor made too many requests too quickly and must wait before retrying. */
export class RateLimitedError extends DomainError {
  readonly code = "RATE_LIMITED";

  constructor(
    message: string,
    readonly retryAfterSeconds?: number,
  ) {
    super(message);
  }
}

export function isDomainError(error: unknown): error is DomainError {
  return error instanceof DomainError;
}
