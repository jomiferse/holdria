// No `import "server-only"` guard: this module is infrastructure reached
// only through `auth-gateway.ts` (already guarded) and directly by its own
// integration test — matching the rest of the repository's non-route
// infrastructure modules (e.g. the transactions and portfolio repositories),
// none of which carry the guard either.
import { verifyPassword } from "better-auth/crypto";
import { and, eq, or } from "drizzle-orm";

import { db } from "@/db/client";
import { account, user, verification } from "@/db/schema/auth-schema";
import { UnauthorizedError, ValidationError } from "@/shared/domain/errors";

import { auth } from "./auth";

const FRESH_AGE_MS = 10 * 60 * 1000; // keep in sync with auth.ts session.freshAge

/**
 * Performs the actual account deletion atomically, without depending on
 * Better Auth's own `deleteUser` handler to be transactionally safe.
 *
 * Better Auth's `/delete-user` endpoint verifies the password (or session
 * freshness) correctly, but then deletes the session, account, and user
 * rows as three separate, non-transactional database calls
 * (`internalAdapter.deleteUser` in `better-auth/dist/db/internal-adapter`)
 * — a crash or connection loss between those calls can leave a partially
 * deleted account (e.g. sessions and the credential account gone but the
 * canonical user row, and therefore every cascade-owned Holdria table,
 * still present). This function re-implements the same secure
 * confirmation Better Auth's endpoint performs — verifying the supplied
 * password with Better Auth's own hashing (`better-auth/crypto`, the same
 * scrypt implementation `auth.ts` relies on for every other credential
 * check — see design.md decision 3 on not reimplementing security-critical
 * crypto) or, when no password is supplied, the same session-freshness
 * window — and then performs the canonical deletion itself as one
 * PostgreSQL transaction:
 *
 * 1. Removes any pending Better Auth `verification` rows for this user.
 *    That table has no `userId` foreign key (email verification, password
 *    reset, and delete-account tokens all store the user's id or email as
 *    a plain `value` column instead), so it cannot cascade and must be
 *    cleaned up explicitly.
 * 2. Deletes the canonical `user` row. Every other Better Auth table
 *    (`session`, `account`) and every Holdria-owned table (`portfolios`,
 *    `instruments`, `instrument_external_references`, `ledger_entries`,
 *    `price_observations`) cascades from that single delete via
 *    `ON DELETE CASCADE` foreign keys (auth-schema.ts, and the Holdria
 *    schema's ownership foreign keys — tasks.md 2.5), so this one
 *    statement is sufficient.
 *
 * If the transaction fails partway (constraint violation, connection
 * loss, process crash), PostgreSQL rolls back the whole transaction —
 * verification rows and the user row are either both gone or both still
 * present; there is no partially deleted state.
 *
 * The caller (`auth-gateway.ts`'s `deleteAccount`) still calls Better
 * Auth's own `signOut` afterward purely to clear the session cookie via
 * its cookie helpers — that call is safe even though the session row is
 * already gone (Better Auth's `/sign-out` handler tolerates a missing
 * session and always clears the cookie).
 */
export async function deleteAccountAtomically(headers: Headers, input: { password?: string }): Promise<void> {
  const session = await auth.api.getSession({ headers });
  if (!session) {
    throw new UnauthorizedError("You must be signed in to delete your account.");
  }

  if (input.password) {
    const [credentialAccount] = await db
      .select()
      .from(account)
      .where(and(eq(account.userId, session.user.id), eq(account.providerId, "credential")))
      .limit(1);

    if (!credentialAccount?.password) {
      throw new ValidationError("This account does not have a password set.");
    }
    const valid = await verifyPassword({ hash: credentialAccount.password, password: input.password });
    if (!valid) {
      throw new ValidationError("Incorrect password.");
    }
  } else {
    const isFresh = Date.now() - session.session.updatedAt.getTime() < FRESH_AGE_MS;
    if (!isFresh) {
      throw new ValidationError(
        "Your session isn't recent enough to delete your account without confirming your password.",
      );
    }
  }

  const userId = session.user.id;
  const userEmail = session.user.email;

  await db.transaction(async (tx) => {
    await tx.delete(verification).where(or(eq(verification.value, userId), eq(verification.value, userEmail)));
    const deletedUsers = await tx.delete(user).where(eq(user.id, userId)).returning({ id: user.id });
    if (deletedUsers.length === 0) {
      // Session referenced a user row that is already gone (e.g. a second
      // concurrent deletion request) — surface the same not-signed-in
      // error rather than silently succeeding.
      throw new UnauthorizedError("This account has already been deleted.");
    }
  });
}
