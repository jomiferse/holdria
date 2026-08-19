import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";

import { db } from "@/db/client";
import { env } from "@/config/env";
import * as authSchema from "@/db/schema/auth-schema";

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
  },
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
  },
  session: {
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
});
