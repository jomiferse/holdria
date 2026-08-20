import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { createTestUser, deleteTestUser } from "@/db/test-utils";
import type { UserId } from "@/shared/domain/user-id";
import { toPortfolioId } from "../domain/portfolio";
import { DrizzlePortfolioRepository } from "./drizzle-portfolio-repository";

/**
 * Exercises the repository against a real PostgreSQL database (see
 * design.md decision 12 — integration tests cover ownership joins and
 * constraints that a fake repository cannot). Requires `DATABASE_URL` to
 * point at a reachable database; skipped automatically otherwise so unit
 * test runs stay database-free.
 */
const hasDatabase = Boolean(process.env.DATABASE_URL);
const maybeDescribe = hasDatabase ? describe : describe.skip;

maybeDescribe("DrizzlePortfolioRepository", () => {
  const repository = new DrizzlePortfolioRepository();
  let owner: UserId;
  let stranger: UserId;

  beforeEach(async () => {
    owner = await createTestUser();
    stranger = await createTestUser();
  });

  afterEach(async () => {
    await deleteTestUser(owner);
    await deleteTestUser(stranger);
  });

  it("creates and lists only the owner's own portfolios", async () => {
    await repository.create(owner, "Retirement");
    await repository.create(stranger, "Someone else's");

    const rows = await repository.listOwned(owner);
    expect(rows).toHaveLength(1);
    expect(rows[0].name).toBe("Retirement");
    expect(rows[0].currency).toBe("EUR");
  });

  it("does not find another user's portfolio by id (cross-tenant read denial)", async () => {
    const created = await repository.create(owner, "Mine");
    const result = await repository.findOwnedById(stranger, created.id);
    expect(result).toBeNull();
  });

  it("does not rename another user's portfolio", async () => {
    const created = await repository.create(owner, "Mine");
    const result = await repository.rename(stranger, created.id, "Stolen");
    expect(result).toBeNull();

    const stillOwned = await repository.findOwnedById(owner, created.id);
    expect(stillOwned?.name).toBe("Mine");
  });

  it("does not delete another user's portfolio", async () => {
    const created = await repository.create(owner, "Mine");
    const deleted = await repository.delete(stranger, created.id);
    expect(deleted).toBe(false);
    expect(await repository.findOwnedById(owner, created.id)).not.toBeNull();
  });

  it("deletes an owned portfolio", async () => {
    const created = await repository.create(owner, "Mine");
    const deleted = await repository.delete(owner, created.id);
    expect(deleted).toBe(true);
    expect(await repository.findOwnedById(owner, created.id)).toBeNull();
  });

  it("returns null for an id that does not exist at all", async () => {
    const result = await repository.findOwnedById(owner, toPortfolioId("00000000-0000-0000-0000-000000000000"));
    expect(result).toBeNull();
  });

  it("cascades portfolio deletion when the owning user is deleted", async () => {
    const created = await repository.create(owner, "Cascades away");
    await deleteTestUser(owner);
    expect(await repository.findOwnedById(owner, created.id)).toBeNull();
    // Reset so the afterEach delete of an already-gone user is a no-op.
    owner = await createTestUser();
  });
});
