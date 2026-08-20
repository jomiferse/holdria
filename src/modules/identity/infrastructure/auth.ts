import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";

import { db } from "@/db/client";
import { env } from "@/config/env";
import * as authSchema from "@/db/schema/auth-schema";
import { getEmailPort } from "@/modules/identity/infrastructure/email";
import {
  passwordChangedEmail,
  passwordResetEmail,
  verificationEmail,
} from "@/modules/identity/infrastructure/email/templates";

const ONE_DAY_SECONDS = 60 * 60 * 24;

/**
 * Better Auth server instance — the single source of truth for
 * authentication in Holdria.
 *
 * This file is the only place outside `better-auth` itself that may import
 * Better Auth's runtime types. Every other module (including the rest of
 * `identity`) interacts with the authenticated actor through the `UserId`
 * abstraction, never through `auth` or its request/session types directly.
 *
 * `auth.$context.options.database` (via `drizzleAdapter`) stores Better
 * Auth's own tables in Holdria's PostgreSQL database, under the same
 * migration and backup policy as every other table. There is no separate
 * identity-account mapping: Better Auth's generated user UUID *is* the
 * canonical Holdria user identifier.
 */
export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: authSchema,
  }),
  baseURL: env.BETTER_AUTH_URL,
  secret: env.BETTER_AUTH_SECRET,
  trustedOrigins: env.TRUSTED_ORIGINS,
  advanced: {
    database: {
      generateId: false, // PostgreSQL generates UUIDs (see auth-schema.ts defaults).
    },
    // Explicit even though it matches Better Auth's default: cookies must
    // always be `Secure` in production, and pinning the value keeps a
    // future Better Auth upgrade from silently loosening it (design.md
    // risk: "Better Auth upgrade changes its generated schema or
    // behavior").
    useSecureCookies: env.NODE_ENV === "production",
    // CSRF protection (origin validation + Fetch Metadata checks) stays
    // enabled; pinned explicitly for the same reason as useSecureCookies.
    disableCSRFCheck: false,
  },
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
    // Password hashing/verification intentionally uses Better Auth's
    // secure default (Scrypt) rather than a custom implementation — see
    // design.md decision 3 ("recreates high-risk security functionality
    // already provided by a focused self-hosted library").
    minPasswordLength: 8,
    maxPasswordLength: 128,
    sendResetPassword: async ({ user, url }) => {
      await getEmailPort().send({ ...passwordResetEmail(url), to: user.email });
    },
    resetPasswordTokenExpiresIn: 60 * 60, // 1 hour
    // A user who forgets their password and resets it revokes every other
    // active session, matching the "preserves only sessions allowed by the
    // configured security policy" identity spec scenario.
    revokeSessionsOnPasswordReset: true,
    onPasswordReset: async ({ user }) => {
      await getEmailPort().send({ ...passwordChangedEmail(), to: user.email });
    },
  },
  emailVerification: {
    sendVerificationEmail: async ({ user, url }) => {
      await getEmailPort().send({ ...verificationEmail(url), to: user.email });
    },
    expiresIn: 60 * 60, // 1 hour
    // Signing the user in right after they verify avoids forcing a second,
    // redundant sign-in immediately after registration.
    autoSignInAfterVerification: true,
  },
  session: {
    expiresIn: 30 * ONE_DAY_SECONDS,
    updateAge: ONE_DAY_SECONDS,
    // A session must have been created or refreshed within the last 10
    // minutes to be "fresh". Account deletion requires a fresh session or
    // password confirmation (identity spec: "Account deletion lacks
    // security confirmation").
    freshAge: 60 * 10,
    // Cookie-cache stays disabled so revocation and account deletion take
    // effect immediately instead of waiting out a cached session cookie.
    cookieCache: {
      enabled: false,
    },
  },
  user: {
    deleteUser: {
      enabled: true,
    },
  },
  // Authentication endpoints (sign-in, sign-up, password reset, etc.) are
  // rate-limited without Redis or another external store: the `database`
  // storage persists counters in Holdria's own PostgreSQL database, so
  // limits hold across restarts and every application replica shares the
  // same counters (design.md non-goal: no Redis).
  rateLimit: {
    // See `env.DISABLE_AUTH_RATE_LIMIT`: disabled only for the Playwright
    // E2E `webServer`, which legitimately issues many real sign-up/sign-in
    // requests from one host in quick succession. Every other environment
    // keeps this enabled.
    enabled: !env.DISABLE_AUTH_RATE_LIMIT,
    storage: "database",
    window: 60,
    max: 30,
    customRules: {
      "/sign-in/email": { window: 60, max: 5 },
      "/sign-up/email": { window: 60, max: 5 },
      "/request-password-reset": { window: 60, max: 3 },
      "/reset-password": { window: 60, max: 5 },
      "/change-password": { window: 60, max: 5 },
      "/delete-user": { window: 60, max: 5 },
      "/send-verification-email": { window: 60, max: 3 },
    },
  },
});
