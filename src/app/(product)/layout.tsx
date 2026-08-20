import { redirect } from "next/navigation";

import { getCurrentActor } from "@/modules/identity/application/actor";

/**
 * Authenticated-area route guard (tasks.md 3.7). Sends a signed-out visitor
 * to sign-in and an unverified user back to the verification-pending
 * screen — the identity spec's "Unverified account attempts product
 * access" scenario.
 *
 * This is navigation-level convenience, not the authorization boundary:
 * design.md decision 4 requires every command and query to re-check the
 * actor itself (`requireVerifiedActor`), since a layout does not stop a
 * Server Action or nested route from running.
 */
export default async function ProductLayout({ children }: { children: React.ReactNode }) {
  const actor = await getCurrentActor();
  if (!actor) {
    redirect("/sign-in");
  }
  if (!actor.emailVerified) {
    redirect(`/sign-up/pending?email=${encodeURIComponent(actor.email)}`);
  }

  return <>{children}</>;
}
