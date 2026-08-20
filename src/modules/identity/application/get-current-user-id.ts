import { headers } from "next/headers";

import { auth } from "@/modules/identity/infrastructure/auth";
import { UnauthorizedError } from "@/shared/domain/errors";
import { toUserId, type UserId } from "@/shared/domain/user-id";

/**
 * Resolves the authenticated actor's canonical `UserId` from the current
 * request's database-backed Better Auth session.
 *
 * This is the only place outside `identity/infrastructure/auth.ts` that
 * touches a Better Auth session object; every Server Action and query in
 * every other module calls this function and receives an opaque `UserId`,
 * never a Better Auth session or user record (design.md decision 3).
 *
 * This is a minimal slice of the identity module's actor abstraction
 * (openspec task 3.4) — just enough for other modules' Server Actions to
 * resolve the acting owner. Verified-email enforcement, route protection,
 * and the rest of module 3 land with the identity module itself; do not
 * treat this function as satisfying that task's full scope.
 */
export async function getCurrentUserId(): Promise<UserId> {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session?.user?.id) {
    throw new UnauthorizedError("Authentication is required.");
  }

  return toUserId(session.user.id);
}
