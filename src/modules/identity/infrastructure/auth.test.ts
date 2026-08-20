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

  function setNodeEnv(value: string): void {
    vi.stubEnv("NODE_ENV", value);
  }

  afterEach(() => {
    setNodeEnv(originalNodeEnv ?? "test");
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

  it("requires email verification before product access", async () => {
    const { auth } = await import("./auth");
    expect(auth.options.emailAndPassword?.requireEmailVerification).toBe(true);
  });

  it("enables user deletion", async () => {
    const { auth } = await import("./auth");
    expect(auth.options.user?.deleteUser?.enabled).toBe(true);
  });
});
