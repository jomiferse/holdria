import { randomUUID } from "node:crypto";

import { eq } from "drizzle-orm";

import { db } from "@/db/client";
import { user } from "@/db/schema/auth-schema";
import { toUserId, type UserId } from "@/shared/domain/user-id";

/**
 * Creates a throwaway Better Auth user row directly (no registration
 * flow — identity module 3's UI is out of scope here) so integration
 * tests have a real, foreign-key-satisfying owner. Every Holdria table
 * cascades from this row, so deleting it tears down everything the test
 * created under it.
 */
export async function createTestUser(): Promise<UserId> {
  const id = randomUUID();
  const [row] = await db
    .insert(user)
    .values({
      id,
      name: "Test User",
      email: `test-${id}@example.invalid`,
      emailVerified: true,
    })
    .returning({ id: user.id });

  return toUserId(row.id);
}

export async function deleteTestUser(id: UserId): Promise<void> {
  await db.delete(user).where(eq(user.id, id));
}
