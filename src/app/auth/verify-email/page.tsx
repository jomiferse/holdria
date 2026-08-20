import type { Metadata } from "next";
import Link from "next/link";
import { CheckCircle2, XCircle } from "lucide-react";

export const metadata: Metadata = { title: "Email verification · Holdria" };

const ERROR_MESSAGES: Record<string, string> = {
  TOKEN_EXPIRED: "This verification link has expired. Request a new one from the sign-in page.",
  INVALID_TOKEN: "This verification link is invalid. Request a new one from the sign-in page.",
  USER_NOT_FOUND: "We couldn't find an account for this verification link.",
};

/**
 * Landing page for Better Auth's `/api/auth/verify-email` redirect
 * (`callbackURL` configured in `auth-gateway.ts`'s `signUp`). Success has
 * no `error` query param; failure appends `?error=<CODE>`.
 */
export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  if (error) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
        <XCircle className="size-10 text-destructive" aria-hidden="true" />
        <h1 className="text-lg font-medium">Verification failed</h1>
        <p role="alert" className="max-w-sm text-sm text-muted-foreground">
          {ERROR_MESSAGES[error] ?? "We couldn't verify your email. Please try again."}
        </p>
        <a href="/sign-in" className="text-sm text-primary underline-offset-4 hover:underline">
          Back to sign in
        </a>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
      <CheckCircle2 className="size-10 text-primary" aria-hidden="true" />
      <h1 className="text-lg font-medium">Email verified</h1>
      <p role="status" className="max-w-sm text-sm text-muted-foreground">
        Your email is verified and you&apos;re signed in.
      </p>
      <Link href="/" className="text-sm text-primary underline-offset-4 hover:underline">
        Continue to Holdria
      </Link>
    </div>
  );
}
