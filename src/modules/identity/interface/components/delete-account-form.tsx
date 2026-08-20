"use client";

import { useActionState } from "react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { deleteAccountAction } from "../actions";
import { idleActionState } from "../action-state";
import { FieldError, FormError } from "./form-error";
import { SubmitButton } from "./submit-button";

/**
 * Permanent account deletion, gated by password confirmation (identity
 * spec: "Account deletion lacks security confirmation") and a typed
 * "DELETE" confirmation to guard against an accidental submit.
 */
export function DeleteAccountForm() {
  const [state, action] = useActionState(deleteAccountAction, idleActionState);

  return (
    <form action={action} noValidate className="flex flex-col gap-4">
      <FormError message={state.status === "error" ? state.message : undefined} />

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="delete-account-password">Confirm your password</Label>
        <Input
          id="delete-account-password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          aria-invalid={!!state.fieldErrors?.password}
          aria-describedby={state.fieldErrors?.password ? "delete-password-error" : undefined}
        />
        <FieldError id="delete-password-error" errors={state.fieldErrors?.password} />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="confirmation">Type DELETE to confirm</Label>
        <Input
          id="confirmation"
          name="confirmation"
          required
          aria-invalid={!!state.fieldErrors?.confirmation}
          aria-describedby={state.fieldErrors?.confirmation ? "confirmation-error" : undefined}
        />
        <FieldError id="confirmation-error" errors={state.fieldErrors?.confirmation} />
      </div>

      <SubmitButton pendingLabel="Deleting account…" variant="destructive">
        Permanently delete account
      </SubmitButton>
    </form>
  );
}
