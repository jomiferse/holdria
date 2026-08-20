import type { Metadata } from "next";

import { SignUpForm } from "@/modules/identity/interface/components/sign-up-form";

export const metadata: Metadata = { title: "Create your account · Holdria" };

export default function SignUpPage() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1 text-center">
        <h1 className="text-lg font-medium">Create your account</h1>
        <p className="text-sm text-muted-foreground">
          Track your investment portfolios without spreadsheets or broker integrations.
        </p>
      </div>
      <SignUpForm />
      <p className="text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <a href="/sign-in" className="text-primary underline-offset-4 hover:underline">
          Sign in
        </a>
      </p>
    </div>
  );
}
