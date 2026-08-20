"use client";

import { useActionState } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";

import { resendVerificationAction } from "../actions";
import { idleActionState } from "../action-state";
import { FormError } from "./form-error";
import { SubmitButton } from "./submit-button";

export function ResendVerificationForm({ email }: { email: string }) {
  const [state, action] = useActionState(resendVerificationAction, idleActionState);

  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="email" value={email} />
      <FormError message={state.status === "error" ? state.message : undefined} />
      {state.status === "success" && (
        <Alert role="status" aria-live="polite">
          <AlertDescription>{state.message}</AlertDescription>
        </Alert>
      )}
      <SubmitButton pendingLabel="Sending…" variant="outline">
        Resend verification email
      </SubmitButton>
    </form>
  );
}
