import "server-only";

import { headers as nextHeaders } from "next/headers";
import { APIError } from "better-auth";

import {
  ConflictError,
  RateLimitedError,
  UnauthorizedError,
  ValidationError,
} from "@/shared/domain/errors";
import { EmailNotVerifiedError } from "@/modules/identity/domain/errors";

import { deleteAccountAtomically } from "./account-deletion";
import { auth } from "./auth";
import { applyAuthResponseCookies } from "./cookie-bridge";

/**
 * The mutation-side counterpart to `session.ts`'s actor abstraction: every
 * Server Action that signs a user up, in, or out, or changes account
 * security state, calls through this gateway instead of importing `auth`
 * or Better Auth's `APIError` directly. This keeps Better Auth's runtime
 * types confined to identity infrastructure (design.md decision 3) and
 * gives every caller one plain, mapped error shape (`shared/domain/errors`).
 */

function mapAuthError(error: unknown): never {
  if (error instanceof APIError) {
    const message = error.body?.message ?? "The request could not be completed.";
    switch (error.status) {
      case "UNAUTHORIZED":
      case "FORBIDDEN":
        throw new UnauthorizedError(message);
      case "CONFLICT":
        throw new ConflictError(message);
      case "TOO_MANY_REQUESTS": {
        const retryAfterHeader = error.headers instanceof Headers
          ? error.headers.get("X-Retry-After")
          : undefined;
        const retryAfterSeconds = retryAfterHeader ? Number(retryAfterHeader) : undefined;
        throw new RateLimitedError(
          "Too many attempts. Please wait before trying again.",
          Number.isFinite(retryAfterSeconds) ? retryAfterSeconds : undefined,
        );
      }
      default:
        throw new ValidationError(message);
    }
  }
  throw error;
}

async function requestHeaders(): Promise<Headers> {
  return await nextHeaders();
}

export async function signUp(input: {
  name: string;
  email: string;
  password: string;
}): Promise<{ requiresVerification: boolean }> {
  try {
    const result = await auth.api.signUpEmail({
      body: {
        name: input.name,
        email: input.email,
        password: input.password,
        callbackURL: "/auth/verify-email",
      },
      headers: await requestHeaders(),
      returnHeaders: true,
    });
    await applyAuthResponseCookies(result.headers);
    return { requiresVerification: result.response.token === null };
  } catch (error) {
    mapAuthError(error);
  }
}

export async function signIn(input: { email: string; password: string }): Promise<void> {
  try {
    const result = await auth.api.signInEmail({
      body: { email: input.email, password: input.password },
      headers: await requestHeaders(),
      returnHeaders: true,
    });
    await applyAuthResponseCookies(result.headers);
  } catch (error) {
    // Better Auth returns the same generic FORBIDDEN status for every
    // sign-in-time rejection once credentials have already checked out
    // (`requireEmailVerification` is the only such rule configured), so a
    // FORBIDDEN here means the email is unverified — surfaced distinctly
    // so `signInAction` can route to the verification-pending screen
    // instead of a bare "invalid credentials" message.
    if (error instanceof APIError && error.status === "FORBIDDEN") {
      throw new EmailNotVerifiedError(input.email);
    }
    mapAuthError(error);
  }
}

export async function signOut(): Promise<void> {
  const result = await auth.api.signOut({
    headers: await requestHeaders(),
    returnHeaders: true,
  });
  await applyAuthResponseCookies(result.headers);
}

export async function resendVerificationEmail(email: string): Promise<void> {
  try {
    await auth.api.sendVerificationEmail({
      body: { email, callbackURL: "/auth/verify-email" },
      headers: await requestHeaders(),
    });
  } catch (error) {
    mapAuthError(error);
  }
}

/**
 * Always resolves without revealing whether `email` belongs to an
 * account — Better Auth's `/request-password-reset` endpoint itself
 * returns a generic success response either way and only invokes the
 * configured `sendResetPassword` callback for an existing user (identity
 * spec: "Visitor requests password recovery").
 */
export async function requestPasswordReset(email: string): Promise<void> {
  try {
    await auth.api.requestPasswordReset({
      body: { email, redirectTo: "/auth/reset-password" },
      headers: await requestHeaders(),
    });
  } catch (error) {
    mapAuthError(error);
  }
}

export async function resetPassword(input: { token: string; newPassword: string }): Promise<void> {
  try {
    await auth.api.resetPassword({
      body: { token: input.token, newPassword: input.newPassword },
    });
  } catch (error) {
    mapAuthError(error);
  }
}

export async function changePassword(input: {
  currentPassword: string;
  newPassword: string;
  revokeOtherSessions: boolean;
}): Promise<void> {
  try {
    const result = await auth.api.changePassword({
      body: {
        currentPassword: input.currentPassword,
        newPassword: input.newPassword,
        revokeOtherSessions: input.revokeOtherSessions,
      },
      headers: await requestHeaders(),
      returnHeaders: true,
    });
    await applyAuthResponseCookies(result.headers);
  } catch (error) {
    mapAuthError(error);
  }
}

/**
 * Permanently deletes the current user, requiring the fresh-session or
 * password confirmation the identity spec's "Account deletion lacks
 * security confirmation" scenario calls for.
 *
 * Deliberately does not call Better Auth's `auth.api.deleteUser` for the
 * deletion itself — see `deleteAccountAtomically`'s doc comment for why
 * that handler cannot be relied on to be transactionally atomic. The
 * password/freshness confirmation and the actual deletion both happen in
 * `deleteAccountAtomically`; this function only clears the session cookie
 * afterward, reusing Better Auth's own `/sign-out` handler (safe even
 * though the session row is already gone via cascade).
 */
export async function deleteAccount(input: { password?: string }): Promise<void> {
  try {
    await deleteAccountAtomically(await requestHeaders(), input);
  } catch (error) {
    mapAuthError(error);
  }

  const result = await auth.api.signOut({
    headers: await requestHeaders(),
    returnHeaders: true,
  });
  await applyAuthResponseCookies(result.headers);
}
