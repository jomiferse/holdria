"use client";

import { useActionState } from "react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { signInAction } from "../actions";
import { idleActionState } from "../action-state";
import { FieldError, FormError } from "./form-error";
import { SubmitButton } from "./submit-button";

export function SignInForm() {
  const [state, action] = useActionState(signInAction, idleActionState);

  return (
    <form action={action} noValidate className="flex flex-col gap-4">
      <FormError message={state.status === "error" ? state.message : undefined} />

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          defaultValue={state.values?.email}
          aria-invalid={!!state.fieldErrors?.email}
          aria-describedby={state.fieldErrors?.email ? "email-error" : undefined}
        />
        <FieldError id="email-error" errors={state.fieldErrors?.email} />
      </div>

      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <Label htmlFor="password">Password</Label>
          <a href="/forgot-password" className="text-sm text-primary underline-offset-4 hover:underline">
            Forgot password?
          </a>
        </div>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          aria-invalid={!!state.fieldErrors?.password}
          aria-describedby={state.fieldErrors?.password ? "password-error" : undefined}
        />
        <FieldError id="password-error" errors={state.fieldErrors?.password} />
      </div>

      <SubmitButton pendingLabel="Signing in…">Sign in</SubmitButton>
    </form>
  );
}
