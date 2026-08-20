"use client";

import { useActionState } from "react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { resetPasswordAction } from "../actions";
import { idleActionState } from "../action-state";
import { FieldError, FormError } from "./form-error";
import { SubmitButton } from "./submit-button";

export function ResetPasswordForm({ token }: { token: string }) {
  const [state, action] = useActionState(resetPasswordAction, idleActionState);

  return (
    <form action={action} noValidate className="flex flex-col gap-4">
      <FormError message={state.status === "error" ? state.message : undefined} />
      <input type="hidden" name="token" value={token} />

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="password">New password</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          aria-invalid={!!state.fieldErrors?.password}
          aria-describedby={state.fieldErrors?.password ? "password-error" : undefined}
        />
        <FieldError id="password-error" errors={state.fieldErrors?.password} />
      </div>

      <SubmitButton pendingLabel="Resetting…">Reset password</SubmitButton>
    </form>
  );
}
