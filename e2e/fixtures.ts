import "dotenv/config";

import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { test as base, type Browser, type BrowserContext, type Page } from "@playwright/test";

import { db } from "@/db/client";
import { user } from "@/db/schema/auth-schema";

/**
 * Signs a fresh, uniquely-emailed user up and in through the running
 * server's real Better Auth HTTP API, using `context.request` — the same
 * cookie jar as `context`'s pages — so the resulting session cookie is
 * set exactly the way a real sign-in response sets it (name, `Secure`
 * attribute, `__Secure-` prefix in production, encoding) rather than
 * reconstructed by hand.
 *
 * Earlier revisions called Better Auth's server API directly (in-process)
 * and copied the `Set-Cookie` header into the context via
 * `context.addCookies`. That approach silently failed against a
 * production build: `useSecureCookies` (see `auth.ts`) makes Better Auth
 * issue a `__Secure-`-prefixed, `Secure` cookie, and Chromium does not
 * attach a `Secure` cookie that was injected via `addCookies` to a plain
 * `http://localhost` request — only a cookie set through a real
 * `Set-Cookie` response header gets the "localhost is a trustworthy
 * origin" treatment browsers give normal navigation. Going through
 * `context.request` sidesteps that gap entirely.
 *
 * Email verification is satisfied by writing `emailVerified` directly in
 * `holdria_test` — the identity module's verification flow is out of
 * scope for tests that are not themselves about verification.
 */
export async function createAuthenticatedUserOnContext(
  context: BrowserContext,
): Promise<{ userId: string; email: string }> {
  const email = `e2e-${randomUUID()}@example.invalid`;
  const password = "correct horse battery staple 42!";

  const signUpResponse = await context.request.post("/api/auth/sign-up/email", {
    data: { email, password, name: "E2E User" },
  });
  if (!signUpResponse.ok()) {
    throw new Error(`Fixture sign-up failed: ${signUpResponse.status()} ${await signUpResponse.text()}`);
  }
  const { user: signedUpUser } = (await signUpResponse.json()) as { user: { id: string } };

  await db.update(user).set({ emailVerified: true }).where(eq(user.id, signedUpUser.id));

  const signInResponse = await context.request.post("/api/auth/sign-in/email", {
    data: { email, password },
  });
  if (!signInResponse.ok()) {
    throw new Error(`Fixture sign-in failed: ${signInResponse.status()} ${await signInResponse.text()}`);
  }

  return { userId: signedUpUser.id, email };
}

/** Creates a fresh browser context pre-authenticated as a new, isolated user. Caller is responsible for closing the context and calling `deleteUser`. */
export async function createAuthenticatedContext(
  browser: Browser,
  baseURL: string,
): Promise<{ userId: string; email: string; context: BrowserContext }> {
  const context = await browser.newContext({ baseURL });
  const { userId, email } = await createAuthenticatedUserOnContext(context);
  return { userId, email, context };
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
    const { userId, context } = await createAuthenticatedContext(browser, baseURL ?? "http://localhost:3000");
    const page = await context.newPage();
    await use(page);
    await context.close();
    await deleteUser(userId);
  },
});

export { expect } from "@playwright/test";
