import { z } from "zod";

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
   */
  DISABLE_AUTH_RATE_LIMIT: z
    .enum(["true", "false"])
    .default("false")
    .transform((value) => value === "true"),
});

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
