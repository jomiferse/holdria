import { eq } from "drizzle-orm";

import { db } from "@/db/client";
import { user as userTable } from "@/db/schema/auth-schema";
import { auth } from "@/modules/identity/infrastructure/auth";

/**
 * Reusable authenticated-user fixture for PostgreSQL integration tests
 * (task 1.5). Creates a real Better Auth user through the same code path
 * production traffic uses, then marks it verified directly in the
 * database — skipping the email round trip, not the identity system
 * itself — and signs in to obtain a real session. Nothing here depends on
 * a production account; every user is created fresh per call and truncated
 * away by `resetDatabase()` between tests.
 */

let counter = 0;

export type TestUser = {
  userId: string;
  email: string;
  password: string;
  /** Carries the session cookie; pass to `auth.api.*({ headers })` calls. */
  headers: Headers;
};

export async function createVerifiedUser(overrides?: {
  email?: string;
  password?: string;
  name?: string;
}): Promise<TestUser> {
  counter += 1;
  const email = overrides?.email ?? `test-user-${Date.now()}-${counter}@example.com`;
  const password = overrides?.password ?? "correct-horse-battery-staple-1";
  const name = overrides?.name ?? "Test User";

  await auth.api.signUpEmail({ body: { name, email, password } });
  await db.update(userTable).set({ emailVerified: true }).where(eq(userTable.email, email));

  const signIn = await auth.api.signInEmail({
    body: { email, password },
    returnHeaders: true,
  });

  const cookieHeader = signIn.headers
    .getSetCookie()
    .map((raw) => raw.split(";")[0])
    .join("; ");

  return {
    userId: signIn.response.user.id,
    email,
    password,
    headers: new Headers({ cookie: cookieHeader }),
  };
}
