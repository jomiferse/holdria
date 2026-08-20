import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getCurrentActor } from "@/modules/identity/application/actor";
import { ChangePasswordForm } from "@/modules/identity/interface/components/change-password-form";
import { DeleteAccountForm } from "@/modules/identity/interface/components/delete-account-form";
import { SignOutButton } from "@/modules/identity/interface/components/sign-out-button";

export const metadata: Metadata = { title: "Account · Holdria" };

/**
 * Minimal account/security settings page (tasks.md 3.5, 3.6). The
 * authenticated product shell itself (navigation, portfolios) is module 4
 * scope; this page only hosts identity-owned actions so they have
 * somewhere to live in the meantime.
 *
 * Redirects rather than throwing when unauthenticated (unlike the
 * `requireActor`/`requireVerifiedActor` used by Server Actions and
 * queries): a Server Action that clears the session cookie — sign-out,
 * account deletion — makes Next.js re-render the current page with the
 * new cookie state before the action's own `redirect()` takes effect, and
 * a throw during that incidental re-render surfaces as an error instead
 * of completing the action's redirect. `(product)/layout.tsx` is the real
 * navigation guard; this is a defense-in-depth check that must not crash.
 */
export default async function AccountPage() {
  const actor = await getCurrentActor();
  if (!actor) {
    redirect("/sign-in");
  }

  return (
    <main className="mx-auto flex w-full max-w-lg flex-col gap-6 p-6">
      <div>
        <h1 className="text-lg font-medium">Account</h1>
        <p className="text-sm text-muted-foreground">Signed in as {actor.email}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Change password</CardTitle>
        </CardHeader>
        <CardContent>
          <ChangePasswordForm />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Session</CardTitle>
        </CardHeader>
        <CardContent>
          <SignOutButton />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Delete account</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <p className="text-sm text-muted-foreground">
            This permanently deletes your account and every portfolio, instrument, transaction,
            and price you own. This cannot be undone.
          </p>
          <DeleteAccountForm />
        </CardContent>
      </Card>
    </main>
  );
}
