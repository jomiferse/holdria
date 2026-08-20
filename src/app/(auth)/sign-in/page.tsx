import type { Metadata } from "next";

import { SignInForm } from "@/modules/identity/interface/components/sign-in-form";

export const metadata: Metadata = { title: "Sign in · Holdria" };

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ reset?: string; deleted?: string }>;
}) {
  const params = await searchParams;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1 text-center">
        <h1 className="text-lg font-medium">Sign in</h1>
        <p className="text-sm text-muted-foreground">Welcome back to Holdria.</p>
      </div>
      {params.reset === "success" && (
        <p role="status" className="rounded-lg bg-muted px-3 py-2 text-sm text-foreground">
          Your password was reset. Sign in with your new password.
        </p>
      )}
      {params.deleted === "success" && (
        <p role="status" className="rounded-lg bg-muted px-3 py-2 text-sm text-foreground">
          Your account was permanently deleted.
        </p>
      )}
      <SignInForm />
      <p className="text-center text-sm text-muted-foreground">
        Don&apos;t have an account?{" "}
        <a href="/sign-up" className="text-primary underline-offset-4 hover:underline">
          Create one
        </a>
      </p>
    </div>
  );
}
