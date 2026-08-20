import { beforeEach, describe, expect, it } from "vitest";

import { NotFoundError, ValidationError } from "@/shared/domain/errors";
import { toUserId, type UserId } from "@/shared/domain/user-id";
import { createInstrument, deleteInstrument, updateInstrument } from "./commands";
import { listInstruments } from "./queries";
import { DuplicateIsinError, InstrumentReferencedError } from "../domain/errors";
import { toInstrumentId, type Instrument, type InstrumentId, type NormalizedInstrumentInput } from "../domain/instrument";
import type { InstrumentRepository } from "./instrument-repository";

/** In-memory fake reproducing the two DB-enforced rules the app layer relies on: per-owner ISIN uniqueness and referenced-row deletion protection. */
class FakeInstrumentRepository implements InstrumentRepository {
  private rows: Instrument[] = [];
  private nextId = 0;
  referenced = new Set<InstrumentId>();

  async listOwned(ownerId: UserId): Promise<Instrument[]> {
    return this.rows.filter((row) => row.ownerId === ownerId);
  }

  async findOwnedById(ownerId: UserId, id: InstrumentId): Promise<Instrument | null> {
    return this.rows.find((row) => row.ownerId === ownerId && row.id === id) ?? null;
  }

  async findOwnedByIsin(ownerId: UserId, isin: string): Promise<Instrument | null> {
    return this.rows.find((row) => row.ownerId === ownerId && row.isin === isin) ?? null;
  }

  async create(ownerId: UserId, input: NormalizedInstrumentInput): Promise<Instrument> {
    if (input.isin) {
      const existing = await this.findOwnedByIsin(ownerId, input.isin);
      if (existing) throw new DuplicateIsinError(existing.id);
    }

    const instrument: Instrument = {
      id: toInstrumentId(`instrument-${(this.nextId += 1)}`),
      ownerId,
      currency: "EUR",
      createdAt: new Date(),
      updatedAt: new Date(),
      ...input,
    };
    this.rows.push(instrument);
    return instrument;
  }

  async update(ownerId: UserId, id: InstrumentId, input: NormalizedInstrumentInput): Promise<Instrument | null> {
    const row = await this.findOwnedById(ownerId, id);
    if (!row) return null;

    if (input.isin) {
      const existing = await this.findOwnedByIsin(ownerId, input.isin);
      if (existing && existing.id !== id) throw new DuplicateIsinError(existing.id);
    }

    const updated = { ...row, ...input, updatedAt: new Date() };
    this.rows = this.rows.map((r) => (r.id === id ? updated : r));
    return updated;
  }

  async delete(ownerId: UserId, id: InstrumentId): Promise<boolean> {
    if (this.referenced.has(id)) {
      throw new InstrumentReferencedError();
    }
    const before = this.rows.length;
    this.rows = this.rows.filter((row) => !(row.ownerId === ownerId && row.id === id));
    return this.rows.length < before;
  }
}

const owner = { userId: toUserId("owner-1") };
const stranger = { userId: toUserId("owner-2") };

let repository: FakeInstrumentRepository;
let deps: { repository: InstrumentRepository };

beforeEach(() => {
  repository = new FakeInstrumentRepository();
  deps = { repository };
});

describe("createInstrument", () => {
  it("creates a FUND with a normalized ISIN", async () => {
    const instrument = await createInstrument(deps, owner, {
      type: "FUND",
      name: "World Fund",
      isin: "ie 00b 4l5y983",
    });
    expect(instrument.isin).toBe("IE00B4L5Y983");
  });

  it("rejects a FUND without an ISIN", async () => {
    await expect(createInstrument(deps, owner, { type: "FUND", name: "World Fund" })).rejects.toThrow(
      ValidationError,
    );
  });

  it("allows a STOCK without an ISIN, carrying ticker and market instead", async () => {
    const instrument = await createInstrument(deps, owner, {
      type: "STOCK",
      name: "Apple",
      ticker: "AAPL",
      market: "NASDAQ",
    });
    expect(instrument.isin).toBeNull();
    expect(instrument.ticker).toBe("AAPL");
  });

  it("does not treat ticker as globally unique — two owners may reuse it", async () => {
    await createInstrument(deps, owner, { type: "STOCK", name: "Apple", ticker: "AAPL" });
    const second = await createInstrument(deps, stranger, { type: "STOCK", name: "Apple Inc", ticker: "AAPL" });
    expect(second.ticker).toBe("AAPL");
  });

  it("rejects a duplicate ISIN for the same owner and points at the existing instrument", async () => {
    const first = await createInstrument(deps, owner, { type: "FUND", name: "World Fund", isin: "IE00B4L5Y983" });

    await expect(
      createInstrument(deps, owner, { type: "FUND", name: "Duplicate", isin: "IE00B4L5Y983" }),
    ).rejects.toMatchObject({ existingInstrumentId: first.id });
  });

  it("allows two different owners to use the same ISIN", async () => {
    await createInstrument(deps, owner, { type: "FUND", name: "World Fund", isin: "IE00B4L5Y983" });
    const second = await createInstrument(deps, stranger, { type: "FUND", name: "World Fund", isin: "IE00B4L5Y983" });
    expect(second.isin).toBe("IE00B4L5Y983");
  });

  it("rejects a non-EUR currency", async () => {
    await expect(
      createInstrument(deps, owner, { type: "STOCK", name: "Apple", currency: "USD" }),
    ).rejects.toThrow(ValidationError);
  });
});

describe("updateInstrument", () => {
  it("rejects updating another user's instrument", async () => {
    const instrument = await createInstrument(deps, owner, { type: "STOCK", name: "Apple", ticker: "AAPL" });
    await expect(
      updateInstrument(deps, stranger, { id: instrument.id, type: "STOCK", name: "Hijacked" }),
    ).rejects.toThrow(NotFoundError);
  });
});

describe("deleteInstrument", () => {
  it("deletes an unreferenced instrument", async () => {
    const instrument = await createInstrument(deps, owner, { type: "STOCK", name: "Apple", ticker: "AAPL" });
    await deleteInstrument(deps, owner, instrument.id);
    expect(await listInstruments(deps, owner)).toHaveLength(0);
  });

  it("preserves a referenced instrument and explains the dependency", async () => {
    const instrument = await createInstrument(deps, owner, { type: "STOCK", name: "Apple", ticker: "AAPL" });
    repository.referenced.add(instrument.id);

    await expect(deleteInstrument(deps, owner, instrument.id)).rejects.toThrow(InstrumentReferencedError);
    expect(await listInstruments(deps, owner)).toHaveLength(1);
  });

  it("rejects deleting another user's instrument", async () => {
    const instrument = await createInstrument(deps, owner, { type: "STOCK", name: "Apple", ticker: "AAPL" });
    await expect(deleteInstrument(deps, stranger, instrument.id)).rejects.toThrow(NotFoundError);
  });
});
