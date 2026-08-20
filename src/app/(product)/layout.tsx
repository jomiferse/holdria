import { redirect } from "next/navigation";

import { getActor } from "@/modules/identity/application/actor";
import { UnauthorizedError } from "@/shared/domain/errors";

/**
 * Authenticated product shell. Every route under `(product)` requires a
 * resolved actor; this is a navigation convenience, not the
 * authorization boundary — every command and query re-resolves and
 * re-scopes the actor independently (design.md decision 4).
 *
 * There is no sign-in page yet (identity module 3 UI), so an
 * unauthenticated visitor is sent to the public landing page rather than
 * a route that does not exist.
 */
export default async function ProductLayout({ children }: { children: React.ReactNode }) {
  try {
    await getActor();
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      redirect("/");
    }
    throw error;
  }

  return children;
}
