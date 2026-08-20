import { z } from "zod";

/**
 * True when `url` is a localhost/loopback address — never true for a real
 * deployment's public `BETTER_AUTH_URL`. Exported so `auth.ts` can apply
 * the same "is this actually a local/test server" check as its own
 * independent guard on `DISABLE_AUTH_RATE_LIMIT`, without the two checks
 * drifting out of sync as separately maintained regexes.
 */
export function isLocalAuthUrl(url: string): boolean {
  return /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(url);
}

/**
 * Server-only environment configuration.
 *
 * Import this module only from server code (Server Components, Server
 * Actions, Route Handlers, scripts). Importing it from a Client Component
 * would fail at build time because none of these variables carry the
 * `NEXT_PUBLIC_` prefix, so nothing here is ever bundled to the browser.
 *
 * Validation runs once, at import time, and fails fast with a readable
 * error instead of letting the app boot with a missing or malformed
 * secret.
 */

const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),

  /** Runtime database connection used by the application and Better Auth. */
  DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/ }),

  /**
   * Optional migration-privileged connection. Falls back to DATABASE_URL
   * when the runtime and migration roles are not yet split (e.g. local
   * development).
   */
  MIGRATION_DATABASE_URL: z
    .url({ protocol: /^postgres(ql)?$/ })
    .optional(),

  /** Secret used by Better Auth to sign sessions and tokens. */
  BETTER_AUTH_SECRET: z
    .string()
    .min(32, "BETTER_AUTH_SECRET must be at least 32 characters"),

  /** Public, canonical base URL Better Auth uses for links and cookies. */
  BETTER_AUTH_URL: z.url(),

  /** Comma-separated list of origins allowed to call authenticated APIs. */
  TRUSTED_ORIGINS: z
    .string()
    .default("")
    .transform((value) =>
      value
        .split(",")
        .map((origin) => origin.trim())
        .filter((origin) => origin.length > 0),
    ),

  SMTP_HOST: z.string().min(1),
  SMTP_PORT: z.coerce.number().int().positive().default(587),
  SMTP_SECURE: z
    .enum(["true", "false"])
    .default("false")
    .transform((value) => value === "true"),
  SMTP_USER: z.string().optional(),
  SMTP_PASSWORD: z.string().optional(),
  SMTP_FROM: z.email().default("no-reply@holdria.local"),

  /** Optional structured-logging/observability sink endpoint. */
  OBSERVABILITY_DSN: z.url().optional(),

  /** Port the standalone Node.js server binds to inside its container. */
  PORT: z.coerce.number().int().positive().default(3000),

  /**
   * Test-only escape hatch for Better Auth's authentication rate limiting
   * (see `auth.ts`). Playwright's E2E suite runs many real sign-up/sign-in
   * HTTP requests from the same host in quick succession — legitimate
   * traffic the production rate limit is deliberately not designed to
   * allow. Defaults to disabled so every other environment, including
   * plain local development, keeps the real limits; only the E2E
   * `webServer` sets this to `true` (see `playwright.config.ts`).
   *
   * Deliberately *not* gated on `NODE_ENV !== "production"`: the E2E
   * `webServer` runs the same standalone build `next build`/`next start`
   * always run under `NODE_ENV=production` (so its cookies, CSRF, and
   * other production-only behavior are exercised for real — see
   * `useSecureCookies` below) — a "not production" check would reject the
   * E2E server's own legitimate use just as readily as a real deployment's
   * accidental one. Gated on `BETTER_AUTH_URL` instead: a genuine
   * deployment's public base URL is never `localhost`, so this refusal
   * targets the actual "is this a real deployment" question the
   * NODE_ENV check could not answer.
   */
  DISABLE_AUTH_RATE_LIMIT: z
    .enum(["true", "false"])
    .default("false")
    .transform((value) => value === "true"),
}).refine(
  (value) => !value.DISABLE_AUTH_RATE_LIMIT || isLocalAuthUrl(value.BETTER_AUTH_URL),
  {
    // Defense in depth alongside `auth.ts`'s own independent
    // `BETTER_AUTH_URL` check: an environment that inherited this flag
    // (e.g. a copy-pasted E2E config) fails startup instead of silently
    // running with authentication rate limiting off, unless its own
    // BETTER_AUTH_URL also proves it is a local/test server.
    error: "DISABLE_AUTH_RATE_LIMIT must not be true unless BETTER_AUTH_URL is localhost.",
    path: ["DISABLE_AUTH_RATE_LIMIT"],
  },
);

export type Env = z.infer<typeof envSchema>;

function loadEnv(): Env {
  const parsed = envSchema.safeParse(process.env);

  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((issue) => `  - ${issue.path.join(".") || "(root)"}: ${issue.message}`)
      .join("\n");

    throw new Error(
      `Invalid environment configuration. Check your .env file:\n${issues}`,
    );
  }

  return parsed.data;
}

export const env = loadEnv();

export function migrationDatabaseUrl(): string {
  return env.MIGRATION_DATABASE_URL ?? env.DATABASE_URL;
}
