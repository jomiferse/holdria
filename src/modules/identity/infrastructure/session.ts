import "server-only";

import { cache } from "react";
import { headers } from "next/headers";

import { toUserId, type UserId } from "@/shared/domain/user-id";

import { auth } from "./auth";

/**
 * The authenticated actor abstraction (design.md decision 3 / tasks.md
 * 3.4): the only place outside `auth.ts` and `cookie-bridge.ts` that may
 * import Better Auth's `auth` instance or its session/user shapes.
 *
 * Everything downstream — application commands, Server Actions, Server
 * Components in every module — receives this plain, Better-Auth-free
 * shape instead. Wrapped in React's `cache()` so multiple calls during one
 * render pass share a single session lookup instead of re-querying
 * PostgreSQL per component.
 */
export type Actor = {
  userId: UserId;
  email: string;
  emailVerified: boolean;
};

/**
 * Resolves the current request's actor from its database-backed session
 * cookie, or `null` when there is no session, it is expired, or it was
 * revoked. Never throws for "not signed in" — callers that require an
 * actor use `requireActor`/`requireVerifiedActor` instead.
 */
export const getCurrentActor = cache(async (): Promise<Actor | null> => {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return null;

  return {
    userId: toUserId(session.user.id),
    email: session.user.email,
    emailVerified: session.user.emailVerified,
  };
});

/**
 * Whether the current session was created or refreshed recently enough to
 * be used for a sensitive operation (account deletion) without also
 * requiring password confirmation. Mirrors Better Auth's own
 * `session.freshAge` window configured in `auth.ts`.
 */
export const isCurrentSessionFresh = cache(async (): Promise<boolean> => {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return false;

  const freshAgeMs = 10 * 60 * 1000; // keep in sync with auth.ts session.freshAge
  return Date.now() - session.session.updatedAt.getTime() < freshAgeMs;
});
