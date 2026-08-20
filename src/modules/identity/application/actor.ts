import { headers } from "next/headers";

import { auth } from "@/modules/identity/infrastructure/auth";
import { toUserId, type UserId } from "@/shared/domain/user-id";
import { UnauthorizedError } from "@/shared/domain/errors";

/**
 * The authenticated actor every other module's application layer receives
 * instead of a raw session. This is the "authenticated actor abstraction"
 * design.md assigns to `identity`: it converts a Better Auth session into
 * the opaque, cross-module `UserId`, and it is the only place outside
 * `identity/infrastructure/auth.ts` allowed to call into Better Auth.
 */
export interface Actor {
  readonly userId: UserId;
}

/**
 * Resolves the current request's authenticated actor from the database-
 * backed Better Auth session. Throws `UnauthorizedError` when there is no
 * valid session so callers never proceed with an undefined actor.
 *
 * Server Actions and Server Components call this directly; it must not be
 * imported from Client Components (it reads request headers and hits the
 * database-backed session store).
 */
export async function getActor(): Promise<Actor> {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session?.user) {
    throw new UnauthorizedError("Authentication required.");
  }

  return { userId: toUserId(session.user.id) };
}
