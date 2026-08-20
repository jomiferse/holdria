"use client";

import { useActionState } from "react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { signUpAction } from "../actions";
import { idleActionState } from "../action-state";
import { FieldError, FormError } from "./form-error";
import { SubmitButton } from "./submit-button";

export function SignUpForm() {
  const [state, action] = useActionState(signUpAction, idleActionState);

  return (
    <form action={action} noValidate className="flex flex-col gap-4">
      <FormError message={state.status === "error" ? state.message : undefined} />

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="name">Name</Label>
        <Input
          id="name"
          name="name"
          autoComplete="name"
          required
          defaultValue={state.values?.name}
          aria-invalid={!!state.fieldErrors?.name}
          aria-describedby={state.fieldErrors?.name ? "name-error" : undefined}
        />
        <FieldError id="name-error" errors={state.fieldErrors?.name} />
      </div>

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
        <Label htmlFor="password">Password</Label>
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

      <SubmitButton pendingLabel="Creating account…">Create account</SubmitButton>
    </form>
  );
}
