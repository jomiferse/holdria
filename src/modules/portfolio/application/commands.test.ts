import { beforeEach, describe, expect, it } from "vitest";

import { NotFoundError, ValidationError } from "@/shared/domain/errors";
import { toUserId, type UserId } from "@/shared/domain/user-id";
import { createPortfolio, deletePortfolio, renamePortfolio } from "./commands";
import { getPortfolio, listPortfolios } from "./queries";
import { toPortfolioId, type Portfolio, type PortfolioId } from "../domain/portfolio";
import type { PortfolioRepository } from "./portfolio-repository";

/** In-memory fake so application logic is tested without a database. */
class FakePortfolioRepository implements PortfolioRepository {
  private rows: Portfolio[] = [];
  private nextId = 0;

  async listOwned(ownerId: UserId): Promise<Portfolio[]> {
    return this.rows.filter((row) => row.ownerId === ownerId);
  }

  async findOwnedById(ownerId: UserId, id: PortfolioId): Promise<Portfolio | null> {
    return this.rows.find((row) => row.ownerId === ownerId && row.id === id) ?? null;
  }

  async create(ownerId: UserId, name: string): Promise<Portfolio> {
    const portfolio: Portfolio = {
      id: toPortfolioId(`portfolio-${(this.nextId += 1)}`),
      ownerId,
      name,
      currency: "EUR",
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.rows.push(portfolio);
    return portfolio;
  }

  async rename(ownerId: UserId, id: PortfolioId, name: string): Promise<Portfolio | null> {
    const row = await this.findOwnedById(ownerId, id);
    if (!row) return null;
    const updated = { ...row, name, updatedAt: new Date() };
    this.rows = this.rows.map((r) => (r.id === id ? updated : r));
    return updated;
  }

  async delete(ownerId: UserId, id: PortfolioId): Promise<boolean> {
    const before = this.rows.length;
    this.rows = this.rows.filter((row) => !(row.ownerId === ownerId && row.id === id));
    return this.rows.length < before;
  }
}

const owner = { userId: toUserId("owner-1"), email: "owner@example.test", emailVerified: true };
const stranger = { userId: toUserId("owner-2"), email: "stranger@example.test", emailVerified: true };

let repository: FakePortfolioRepository;
let deps: { repository: PortfolioRepository };

beforeEach(() => {
  repository = new FakePortfolioRepository();
  deps = { repository };
});

describe("createPortfolio", () => {
  it("creates an EUR portfolio owned by the actor", async () => {
    const portfolio = await createPortfolio(deps, owner, { name: "Retirement" });
    expect(portfolio.ownerId).toBe(owner.userId);
    expect(portfolio.currency).toBe("EUR");
  });

  it("rejects a non-EUR currency", async () => {
    await expect(createPortfolio(deps, owner, { name: "Retirement", currency: "USD" })).rejects.toThrow(
      ValidationError,
    );
  });

  it("rejects an empty name", async () => {
    await expect(createPortfolio(deps, owner, { name: "  " })).rejects.toThrow(ValidationError);
  });
});

describe("listPortfolios", () => {
  it("lists only the actor's own portfolios", async () => {
    await createPortfolio(deps, owner, { name: "Mine" });
    await createPortfolio(deps, stranger, { name: "Theirs" });

    const portfolios = await listPortfolios(deps, owner);
    expect(portfolios.map((p) => p.name)).toEqual(["Mine"]);
  });
});

describe("renamePortfolio", () => {
  it("renames an owned portfolio", async () => {
    const created = await createPortfolio(deps, owner, { name: "Old" });
    const renamed = await renamePortfolio(deps, owner, { id: created.id, name: "New" });
    expect(renamed.name).toBe("New");
  });

  it("rejects renaming another user's portfolio (not found, not forbidden)", async () => {
    const created = await createPortfolio(deps, owner, { name: "Mine" });
    await expect(renamePortfolio(deps, stranger, { id: created.id, name: "Stolen" })).rejects.toThrow(
      NotFoundError,
    );
  });
});

describe("deletePortfolio", () => {
  it("deletes an owned portfolio", async () => {
    const created = await createPortfolio(deps, owner, { name: "Gone soon" });
    await deletePortfolio(deps, owner, created.id);
    await expect(getPortfolio(deps, owner, created.id)).rejects.toThrow(NotFoundError);
  });

  it("rejects deleting another user's portfolio", async () => {
    const created = await createPortfolio(deps, owner, { name: "Mine" });
    await expect(deletePortfolio(deps, stranger, created.id)).rejects.toThrow(NotFoundError);
  });
});
