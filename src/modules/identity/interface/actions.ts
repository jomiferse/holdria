"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { ValidationError, isDomainError } from "@/shared/domain/errors";
import { EmailNotVerifiedError } from "@/modules/identity/domain/errors";
import * as authGateway from "@/modules/identity/infrastructure/auth-gateway";
import { requireActor } from "@/modules/identity/application/actor";

import type { ActionState } from "./action-state";
import {
  changePasswordSchema,
  deleteAccountSchema,
  requestPasswordResetSchema,
  resendVerificationSchema,
  resetPasswordSchema,
  signInSchema,
  signUpSchema,
} from "./schemas";

/**
 * Server Actions for every identity flow (tasks.md 3.5). Each action:
 * parses `FormData` with Zod, calls exactly one identity gateway function,
 * maps expected `DomainError`s to accessible field/form feedback, and
 * revalidates or redirects on success. None of these import Better Auth
 * types directly — only `auth-gateway` and `actor` do (design.md decision
 * 3).
 */

function safeValues(formData: FormData, keys: string[]): Record<string, string> {
  const values: Record<string, string> = {};
  for (const key of keys) {
    const value = formData.get(key);
    if (typeof value === "string") values[key] = value;
  }
  return values;
}

function fromDomainError(error: unknown, values?: Record<string, string>): ActionState {
  if (isDomainError(error)) {
    return {
      status: "error",
      message: error.message,
      fieldErrors: error instanceof ValidationError ? error.fieldErrors : undefined,
      values,
    };
  }
  throw error;
}

export async function signUpAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const values = safeValues(formData, ["name", "email"]);
  const parsed = signUpSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { status: "error", fieldErrors: parsed.error.flatten().fieldErrors, values };
  }

  let requiresVerification: boolean;
  try {
    requiresVerification = (await authGateway.signUp(parsed.data)).requiresVerification;
  } catch (error) {
    return fromDomainError(error, values);
  }

  if (requiresVerification) {
    redirect(`/sign-up/pending?email=${encodeURIComponent(parsed.data.email)}`);
  }
  redirect("/");
}

export async function signInAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const values = safeValues(formData, ["email"]);
  const parsed = signInSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { status: "error", fieldErrors: parsed.error.flatten().fieldErrors, values };
  }

  try {
    await authGateway.signIn(parsed.data);
  } catch (error) {
    if (error instanceof EmailNotVerifiedError) {
      redirect(`/sign-up/pending?email=${encodeURIComponent(error.email)}`);
    }
    return fromDomainError(error, values);
  }
  redirect("/");
}

export async function signOutAction(): Promise<void> {
  await authGateway.signOut();
  redirect("/sign-in");
}

export async function resendVerificationAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = resendVerificationSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { status: "error", fieldErrors: parsed.error.flatten().fieldErrors };
  }

  try {
    await authGateway.resendVerificationEmail(parsed.data.email);
  } catch (error) {
    return fromDomainError(error);
  }
  return { status: "success", message: "Verification email sent. Check your inbox." };
}

export async function requestPasswordResetAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const values = safeValues(formData, ["email"]);
  const parsed = requestPasswordResetSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { status: "error", fieldErrors: parsed.error.flatten().fieldErrors, values };
  }

  try {
    await authGateway.requestPasswordReset(parsed.data.email);
  } catch (error) {
    return fromDomainError(error, values);
  }
  // Neutral response regardless of whether the email is registered
  // (identity spec: "avoid disclosing whether an arbitrary recovery email
  // address is registered").
  return {
    status: "success",
    message: "If that email is registered, a recovery link is on its way.",
  };
}

export async function resetPasswordAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = resetPasswordSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { status: "error", fieldErrors: parsed.error.flatten().fieldErrors };
  }

  try {
    await authGateway.resetPassword({
      token: parsed.data.token,
      newPassword: parsed.data.password,
    });
  } catch (error) {
    return fromDomainError(error);
  }
  redirect("/sign-in?reset=success"); // outside try/catch: redirect's control-flow throw must propagate
}

export async function changePasswordAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireActor();
  const parsed = changePasswordSchema.safeParse({
    currentPassword: formData.get("currentPassword"),
    newPassword: formData.get("newPassword"),
    revokeOtherSessions: formData.get("revokeOtherSessions") === "on",
  });
  if (!parsed.success) {
    return { status: "error", fieldErrors: parsed.error.flatten().fieldErrors };
  }

  try {
    await authGateway.changePassword(parsed.data);
  } catch (error) {
    return fromDomainError(error);
  }
  revalidatePath("/account");
  return { status: "success", message: "Password changed." };
}

export async function deleteAccountAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireActor();
  const parsed = deleteAccountSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { status: "error", fieldErrors: parsed.error.flatten().fieldErrors };
  }

  try {
    await authGateway.deleteAccount({ password: parsed.data.password });
  } catch (error) {
    return fromDomainError(error);
  }
  redirect("/sign-in?deleted=success");
}
