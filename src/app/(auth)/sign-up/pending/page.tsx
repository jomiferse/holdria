import type { Metadata } from "next";
import { MailCheck } from "lucide-react";

import { ResendVerificationForm } from "@/modules/identity/interface/components/resend-verification-form";

export const metadata: Metadata = { title: "Verify your email · Holdria" };

export default async function SignUpPendingPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string }>;
}) {
  const { email } = await searchParams;

  return (
    <div className="flex flex-col items-center gap-4 text-center">
      <MailCheck className="size-10 text-primary" aria-hidden="true" />
      <h1 className="text-lg font-medium">Check your inbox</h1>
      <p className="text-sm text-muted-foreground">
        {email ? (
          <>
            We sent a verification link to <strong>{email}</strong>. Open it to activate your
            account.
          </>
        ) : (
          "We sent a verification link to your email. Open it to activate your account."
        )}
      </p>
      {email && <ResendVerificationForm email={email} />}
    </div>
  );
}
