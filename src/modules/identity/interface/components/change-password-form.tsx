"use client";

import { useActionState } from "react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";

import { changePasswordAction } from "../actions";
import { idleActionState } from "../action-state";
import { FieldError, FormError } from "./form-error";
import { SubmitButton } from "./submit-button";

export function ChangePasswordForm() {
  const [state, action] = useActionState(changePasswordAction, idleActionState);

  return (
    <form action={action} noValidate className="flex flex-col gap-4">
      <FormError message={state.status === "error" ? state.message : undefined} />
      {state.status === "success" && (
        <Alert role="status" aria-live="polite">
          <AlertDescription>{state.message}</AlertDescription>
        </Alert>
      )}

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="currentPassword">Current password</Label>
        <Input
          id="currentPassword"
          name="currentPassword"
          type="password"
          autoComplete="current-password"
          required
          aria-invalid={!!state.fieldErrors?.currentPassword}
          aria-describedby={state.fieldErrors?.currentPassword ? "currentPassword-error" : undefined}
        />
        <FieldError id="currentPassword-error" errors={state.fieldErrors?.currentPassword} />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="newPassword">New password</Label>
        <Input
          id="newPassword"
          name="newPassword"
          type="password"
          autoComplete="new-password"
          required
          aria-invalid={!!state.fieldErrors?.newPassword}
          aria-describedby={state.fieldErrors?.newPassword ? "newPassword-error" : undefined}
        />
        <FieldError id="newPassword-error" errors={state.fieldErrors?.newPassword} />
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="revokeOtherSessions" className="size-4" />
        Sign out of all other devices
      </label>

      <SubmitButton pendingLabel="Changing…">Change password</SubmitButton>
    </form>
  );
}
