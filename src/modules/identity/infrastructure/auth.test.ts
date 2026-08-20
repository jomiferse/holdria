import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * Config-level checks for `auth.ts` that don't need a database connection.
 * `vi.resetModules()` + a fresh dynamic import re-evaluates `@/config/env`
 * (and therefore `auth.ts`) against a temporarily patched `NODE_ENV`, so
 * this exercises the same production-vs-development branching the running
 * application uses without spinning up a server.
 */
describe("auth cookie and rate-limit configuration", () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalBetterAuthUrl = process.env.BETTER_AUTH_URL;

  function setNodeEnv(value: string): void {
    vi.stubEnv("NODE_ENV", value);
  }

  afterEach(() => {
    setNodeEnv(originalNodeEnv ?? "test");
    vi.stubEnv("BETTER_AUTH_URL", originalBetterAuthUrl ?? "http://localhost:3000");
    vi.stubEnv("DISABLE_AUTH_RATE_LIMIT", "false");
    vi.resetModules();
  });

  it("forces secure cookies in production", async () => {
    vi.resetModules();
    setNodeEnv("production");
    const { auth } = await import("./auth");
    expect(auth.options.advanced?.useSecureCookies).toBe(true);
  });

  it("does not force secure cookies outside production", async () => {
    vi.resetModules();
    setNodeEnv("development");
    const { auth } = await import("./auth");
    expect(auth.options.advanced?.useSecureCookies).toBe(false);
  });

  it("keeps CSRF protection enabled", async () => {
    const { auth } = await import("./auth");
    expect(auth.options.advanced?.disableCSRFCheck).toBe(false);
  });

  it("disables cookie caching so revocation takes effect immediately", async () => {
    const { auth } = await import("./auth");
    expect(auth.options.session?.cookieCache?.enabled).toBe(false);
  });

  it("stores rate-limit counters in the database, not memory or Redis", async () => {
    const { auth } = await import("./auth");
    expect(auth.options.rateLimit?.enabled).toBe(true);
    expect(auth.options.rateLimit?.storage).toBe("database");
  });

  it("disables rate limiting only when DISABLE_AUTH_RATE_LIMIT is explicitly set for a local BETTER_AUTH_URL", async () => {
    vi.resetModules();
    // Production builds (`next build`/`next start`) always run with
    // NODE_ENV=production — including the Playwright E2E `webServer`
    // itself, which legitimately needs this flag — so the guard is on
    // BETTER_AUTH_URL, not NODE_ENV; production-mode is asserted here too
    // to prove the flag does not depend on leaving production mode.
    setNodeEnv("production");
    vi.stubEnv("BETTER_AUTH_URL", "http://localhost:3100");
    vi.stubEnv("DISABLE_AUTH_RATE_LIMIT", "true");
    const { auth } = await import("./auth");
    expect(auth.options.rateLimit?.enabled).toBe(false);
  });

  it("refuses to start with DISABLE_AUTH_RATE_LIMIT set unless BETTER_AUTH_URL is local, even in production", async () => {
    vi.resetModules();
    setNodeEnv("production");
    vi.stubEnv("BETTER_AUTH_URL", "https://holdria.example.com");
    vi.stubEnv("DISABLE_AUTH_RATE_LIMIT", "true");
    await expect(import("./auth")).rejects.toThrow(/DISABLE_AUTH_RATE_LIMIT/);
  });

  it("requires email verification before product access", async () => {
    const { auth } = await import("./auth");
    expect(auth.options.emailAndPassword?.requireEmailVerification).toBe(true);
  });

  it("enables user deletion", async () => {
    const { auth } = await import("./auth");
    expect(auth.options.user?.deleteUser?.enabled).toBe(true);
  });
});
