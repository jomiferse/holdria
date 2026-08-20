import { UnauthorizedError } from "@/shared/domain/errors";

/**
 * Sign-in was attempted with correct credentials but an unverified email
 * (identity spec: "Unverified account attempts product access"). Kept
 * distinct from the generic `UnauthorizedError` so `signInAction` can
 * route the user to the verification-pending screen instead of a bare
 * "invalid credentials" message.
 */
export class EmailNotVerifiedError extends UnauthorizedError {
  constructor(readonly email: string) {
    super("Verify your email before signing in.");
  }
}
