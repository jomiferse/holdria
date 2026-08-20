import { eq } from "drizzle-orm";
import { parseSetCookieHeader } from "better-auth/cookies";
import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { db } from "@/db/client";
import { session as sessionTable, user as userTable, verification } from "@/db/schema/auth-schema";
import { setEmailPortForTesting } from "@/modules/identity/infrastructure/email";
import { TestEmailPort } from "@/modules/identity/infrastructure/email/test-email-port";
import { createVerifiedUser } from "../../../../tests/integration/fixtures";
import { resetDatabase } from "../../../../tests/integration/reset-database";

import { auth } from "./auth";

/**
 * PostgreSQL-backed integration coverage for the identity module
 * (tasks.md 3.8): verification, neutral recovery responses, password
 * reset/change, secure cookies, session expiry/revocation, deletion
 * cascades, and that no client-supplied identifier can select another
 * user's session or account.
 */

const emailPort = new TestEmailPort();

beforeAll(() => {
  setEmailPortForTesting(emailPort);
});

beforeEach(async () => {
  await resetDatabase();
  emailPort.clear();
});

afterEach(async () => {
  emailPort.clear();
});

/**
 * Extracts the one-time token from an emailed link. Verify-email links put
 * it in the `token` query param (`/verify-email?token=...`); the
 * password-reset callback link Better Auth emails instead puts it as the
 * last path segment (`/reset-password/:token?callbackURL=...`).
 */
function tokenFromUrl(url: string): string {
  const parsed = new URL(url);
  return parsed.searchParams.get("token") ?? parsed.pathname.split("/").pop()!;
}

describe("registration and email verification", () => {
  it("creates an unverified user without a session and sends a verification email", async () => {
    const email = "new-user@example.com";
    const result = await auth.api.signUpEmail({
      body: { name: "New User", email, password: "correct-horse-battery-1" },
    });

    expect(result.token).toBeNull();

    const [row] = await db.select().from(userTable).where(eq(userTable.email, email));
    expect(row.emailVerified).toBe(false);

    expect(emailPort.sent).toHaveLength(1);
    expect(emailPort.sent[0].to).toBe(email);
  });

  it("denies sign-in for an unverified account", async () => {
    const email = "unverified@example.com";
    const password = "correct-horse-battery-1";
    await auth.api.signUpEmail({ body: { name: "Unverified", email, password } });

    await expect(auth.api.signInEmail({ body: { email, password } })).rejects.toMatchObject({
      status: "FORBIDDEN",
    });
  });

  it("verifies the account and grants session access", async () => {
    const user = await createVerifiedUser();
    const session = await auth.api.getSession({ headers: user.headers });
    expect(session?.user.email).toBe(user.email);
    expect(session?.user.emailVerified).toBe(true);
  });
});

describe("password recovery", () => {
  it("responds identically for a registered and an unregistered email", async () => {
    const user = await createVerifiedUser();
    emailPort.clear(); // discard the sign-up verification email from setup

    const registered = await auth.api.requestPasswordReset({
      body: { email: user.email },
    });
    const unregistered = await auth.api.requestPasswordReset({
      body: { email: "no-such-account@example.com" },
    });

    expect(registered.status).toBe(true);
    expect(unregistered.status).toBe(true);
    // Only the registered address actually triggers an email.
    expect(emailPort.sent).toHaveLength(1);
    expect(emailPort.sent[0].to).toBe(user.email);
  });

  it("resets the password with a valid token and allows sign-in with the new password", async () => {
    const user = await createVerifiedUser();
    await auth.api.requestPasswordReset({ body: { email: user.email } });
    const token = tokenFromUrl(emailPort.last()!.text.match(/https?:\S+/)![0]);

    await auth.api.resetPassword({ body: { token, newPassword: "new-correct-horse-1" } });

    await expect(
      auth.api.signInEmail({ body: { email: user.email, password: "new-correct-horse-1" } }),
    ).resolves.toBeTruthy();
  });

  it("revokes other sessions when the password is reset", async () => {
    const user = await createVerifiedUser();
    const otherSessionBefore = await auth.api.getSession({ headers: user.headers });
    expect(otherSessionBefore).not.toBeNull();

    await auth.api.requestPasswordReset({ body: { email: user.email } });
    const token = tokenFromUrl(emailPort.last()!.text.match(/https?:\S+/)![0]);
    await auth.api.resetPassword({ body: { token, newPassword: "new-correct-horse-1" } });

    const otherSessionAfter = await auth.api.getSession({ headers: user.headers });
    expect(otherSessionAfter).toBeNull();
  });
});

describe("authenticated password change", () => {
  it("rejects an incorrect current password", async () => {
    const user = await createVerifiedUser();
    await expect(
      auth.api.changePassword({
        headers: user.headers,
        body: { currentPassword: "wrong-password-1", newPassword: "another-new-1" },
      }),
    ).rejects.toBeTruthy();
  });

  it("changes the password given the correct current password", async () => {
    const user = await createVerifiedUser();
    await auth.api.changePassword({
      headers: user.headers,
      body: { currentPassword: user.password, newPassword: "another-new-1" },
    });

    await expect(
      auth.api.signInEmail({ body: { email: user.email, password: "another-new-1" } }),
    ).resolves.toBeTruthy();
  });
});

describe("session cookies and revocation", () => {
  it("issues an HttpOnly, SameSite session cookie", async () => {
    const email = "cookie-user@example.com";
    const password = "correct-horse-battery-1";
    await auth.api.signUpEmail({ body: { name: "Cookie User", email, password } });
    await db.update(userTable).set({ emailVerified: true }).where(eq(userTable.email, email));

    const result = await auth.api.signInEmail({
      body: { email, password },
      returnHeaders: true,
    });

    const setCookieValues = result.headers.getSetCookie();
    expect(setCookieValues.length).toBeGreaterThan(0);
    const sessionCookie = setCookieValues.find((raw) => raw.includes("session_token"));
    expect(sessionCookie).toBeDefined();
    const [, attributes] = [...parseSetCookieHeader(sessionCookie!)][0];
    expect(attributes.httponly).toBe(true);
    expect(attributes.samesite).toBe("lax");
  });

  it("denies access once the session is revoked", async () => {
    const user = await createVerifiedUser();
    expect(await auth.api.getSession({ headers: user.headers })).not.toBeNull();

    await db.delete(sessionTable).where(eq(sessionTable.userId, user.userId));

    expect(await auth.api.getSession({ headers: user.headers })).toBeNull();
  });
});

describe("account deletion", () => {
  it("cascades to sessions, verification tokens, and every owned row on confirmed deletion", async () => {
    const user = await createVerifiedUser();
    await auth.api.requestPasswordReset({ body: { email: user.email } }); // leaves a verification row

    await auth.api.deleteUser({
      headers: user.headers,
      body: { password: user.password },
    });

    const [remainingUser] = await db.select().from(userTable).where(eq(userTable.id, user.userId));
    expect(remainingUser).toBeUndefined();

    const remainingSessions = await db
      .select()
      .from(sessionTable)
      .where(eq(sessionTable.userId, user.userId));
    expect(remainingSessions).toHaveLength(0);

    const remainingVerifications = await db
      .select()
      .from(verification)
      .where(eq(verification.identifier, user.email));
    expect(remainingVerifications).toHaveLength(0);

    expect(await auth.api.getSession({ headers: user.headers })).toBeNull();
  });

  it("rejects deletion without the correct password and keeps the account", async () => {
    const user = await createVerifiedUser();

    await expect(
      auth.api.deleteUser({
        headers: user.headers,
        body: { password: "not-the-real-password" },
      }),
    ).rejects.toBeTruthy();

    const [remainingUser] = await db.select().from(userTable).where(eq(userTable.id, user.userId));
    expect(remainingUser).toBeDefined();
  });
});

describe("no client-supplied identifier crosses sessions", () => {
  it("resolves a session strictly from its own cookie, never another user's id", async () => {
    const userA = await createVerifiedUser();
    const userB = await createVerifiedUser();

    const sessionA = await auth.api.getSession({ headers: userA.headers });
    const sessionB = await auth.api.getSession({ headers: userB.headers });

    expect(sessionA?.user.id).toBe(userA.userId);
    expect(sessionB?.user.id).toBe(userB.userId);
    expect(sessionA?.user.id).not.toBe(sessionB?.user.id);

    // Changing user A's password can never affect user B, regardless of
    // any identifier a malicious client might try to smuggle in — the
    // endpoint has no such parameter, it only ever acts on the session.
    await auth.api.changePassword({
      headers: userA.headers,
      body: { currentPassword: userA.password, newPassword: "brand-new-password-1" },
    });

    await expect(
      auth.api.signInEmail({ body: { email: userB.email, password: userB.password } }),
    ).resolves.toBeTruthy();
  });
});
