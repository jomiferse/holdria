import { UnauthorizedError } from "@/shared/domain/errors";

import { getCurrentActor, type Actor } from "@/modules/identity/infrastructure/session";

export type { Actor } from "@/modules/identity/infrastructure/session";

/**
 * Public entry point other modules use to resolve the current actor.
 * Re-exports the plain `Actor` shape from identity infrastructure without
 * ever importing Better Auth types itself (design.md decision 3 and
 * tasks.md 3.4).
 */
export { getCurrentActor };

/**
 * Resolves the current actor or throws `UnauthorizedError`. Use in every
 * application command/query entry point (tasks.md 3.7) — page- and
 * layout-level checks improve navigation but are not authorization
 * controls (design.md decision 4).
 */
export async function requireActor(): Promise<Actor> {
  const actor = await getCurrentActor();
  if (!actor) {
    throw new UnauthorizedError("Sign in to continue.");
  }
  return actor;
}

/**
 * Resolves the current actor and requires a verified email, matching the
 * identity spec's "Unverified account attempts product access" scenario.
 * Every product command/query outside identity itself should authorize
 * through this function rather than `requireActor`.
 */
export async function requireVerifiedActor(): Promise<Actor> {
  const actor = await requireActor();
  if (!actor.emailVerified) {
    throw new UnauthorizedError("Verify your email to continue.");
  }
  return actor;
}
