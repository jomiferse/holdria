import "dotenv/config";

import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { test as base, type Page } from "@playwright/test";

import { auth } from "@/modules/identity/infrastructure/auth";
import { db } from "@/db/client";
import { user } from "@/db/schema/auth-schema";

/**
 * Creates a real, signed-in Better Auth session for a throwaway user
 * without going through the (not-yet-built) registration/verification
 * UI: `signUpEmail`/`signInEmail` are Better Auth's own server API, so
 * the resulting session cookie is exactly what the running app would
 * issue. Email verification is satisfied by writing `emailVerified`
 * directly — the identity module's verification flow is out of scope
 * for these tests, which target portfolio and instrument management.
 */
export async function createAuthenticatedUser() {
  const email = `e2e-${randomUUID()}@example.invalid`;
  const password = "correct horse battery staple 42!";

  const signUp = await auth.api.signUpEmail({
    body: { email, password, name: "E2E User" },
  });

  await db.update(user).set({ emailVerified: true }).where(eq(user.id, signUp.user.id));

  const { headers } = await auth.api.signInEmail({
    body: { email, password },
    returnHeaders: true,
  });

  const cookies = headers
    .getSetCookie()
    .map((raw) => {
      const [pair] = raw.split(";");
      const separatorIndex = pair.indexOf("=");
      return { name: pair.slice(0, separatorIndex), value: pair.slice(separatorIndex + 1) };
    })
    .filter((cookie) => cookie.name.includes("session_token"));

  return { userId: signUp.user.id as string, email, cookies };
}

export async function deleteUser(userId: string): Promise<void> {
  await db.delete(user).where(eq(user.id, userId));
}

interface Fixtures {
  authenticatedPage: Page;
}

/** A Playwright test with `authenticatedPage` pre-authenticated as a fresh, isolated user, cleaned up afterward. */
export const test = base.extend<Fixtures>({
  authenticatedPage: async ({ browser, baseURL }, use) => {
    const { userId, cookies } = await createAuthenticatedUser();
    const context = await browser.newContext();
    const url = new URL(baseURL ?? "http://localhost:3000");

    await context.addCookies(
      cookies.map((cookie) => ({
        name: cookie.name,
        value: cookie.value,
        domain: url.hostname,
        path: "/",
      })),
    );

    const page = await context.newPage();
    await use(page);
    await context.close();
    await deleteUser(userId);
  },
});

export { expect } from "@playwright/test";
