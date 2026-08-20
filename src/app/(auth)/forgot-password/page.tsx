import type { Metadata } from "next";

import { ForgotPasswordForm } from "@/modules/identity/interface/components/forgot-password-form";

export const metadata: Metadata = { title: "Reset your password · Holdria" };

export default function ForgotPasswordPage() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1 text-center">
        <h1 className="text-lg font-medium">Reset your password</h1>
        <p className="text-sm text-muted-foreground">
          Enter your account email and we&apos;ll send a link to choose a new password.
        </p>
      </div>
      <ForgotPasswordForm />
      <p className="text-center text-sm text-muted-foreground">
        <a href="/sign-in" className="text-primary underline-offset-4 hover:underline">
          Back to sign in
        </a>
      </p>
    </div>
  );
}
