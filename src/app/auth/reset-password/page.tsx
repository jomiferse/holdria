import type { Metadata } from "next";

import { ResetPasswordForm } from "@/modules/identity/interface/components/reset-password-form";

export const metadata: Metadata = { title: "Choose a new password · Holdria" };

/**
 * Landing page for Better Auth's password-recovery link (`redirectTo`
 * configured in `auth-gateway.ts`'s `requestPasswordReset`), which appends
 * the one-time `token` query parameter after validating it server-side.
 */
export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; error?: string }>;
}) {
  const { token, error } = await searchParams;

  if (!token || error) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
        <h1 className="text-lg font-medium">This link is no longer valid</h1>
        <p role="alert" className="max-w-sm text-sm text-muted-foreground">
          Password recovery links expire after one use or one hour. Request a new one.
        </p>
        <a
          href="/forgot-password"
          className="text-sm text-primary underline-offset-4 hover:underline"
        >
          Request a new link
        </a>
      </div>
    );
  }

  return (
    <div className="flex flex-1 items-center justify-center p-6">
      <div className="flex w-full max-w-sm flex-col gap-6">
        <div className="flex flex-col gap-1 text-center">
          <h1 className="text-lg font-medium">Choose a new password</h1>
        </div>
        <ResetPasswordForm token={token} />
      </div>
    </div>
  );
}
