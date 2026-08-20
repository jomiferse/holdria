/**
 * Structured, privacy-safe logging for unexpected (non-domain) errors
 * (task 9.4). Domain errors (`ValidationError`, `NotFoundError`,
 * `ConflictError`, `InvariantViolationError`, ...) are expected outcomes
 * with deliberately crafted, data-free messages — they are mapped to user
 * feedback by `toErrorFormActionState` and never reach this function.
 *
 * An *unexpected* error (a database driver exception, a programming bug)
 * can carry request content in its own message or stack — a PostgreSQL
 * unique-violation message, for instance, sometimes echoes the offending
 * column value. This logs only the error's name/type and, when present,
 * Next.js's own `digest` (which correlates this line to the full
 * server-side stack trace elsewhere), and deliberately omits `message`
 * and `stack` so credentials, tokens, portfolio values, ledger amounts,
 * and other user data already can't end up in application logs by
 * accident.
 */
export function logUnexpectedError(context: string, error: unknown): void {
  const name = error instanceof Error ? error.name : typeof error;
  const digest =
    typeof error === "object" && error !== null && "digest" in error
      ? (error as { digest?: unknown }).digest
      : undefined;

  console.error(`[${context}] unexpected ${name}`, digest !== undefined ? { digest } : "(no digest)");
}
