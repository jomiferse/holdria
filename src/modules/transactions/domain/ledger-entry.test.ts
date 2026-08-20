import { describe, expect, it } from "vitest";

import { ValidationError } from "@/shared/domain/errors";
import { toUserId } from "@/shared/domain/user-id";

import {
  createBuy,
  createContribution,
  createSell,
  createWithdrawal,
  parseLedgerEntry,
} from "./ledger-entry";

const owner = toUserId("00000000-0000-0000-0000-000000000001");
const portfolioId = "10000000-0000-0000-0000-000000000001";
const instrumentId = "20000000-0000-0000-0000-000000000001";

describe("ledger entry constructors", () => {
  it("creates a CONTRIBUTION that increases cash", () => {
    const entry = createContribution(owner, {
      portfolioId,
      effectiveDate: "2026-01-01",
      cashAmount: "1000",
    });
    expect(entry.type).toBe("CONTRIBUTION");
    expect(entry.cashAmount.toPersistedString()).toBe("1000");
  });

  it("creates a WITHDRAWAL that decreases cash", () => {
    const entry = createWithdrawal(owner, {
      portfolioId,
      effectiveDate: "2026-01-01",
      cashAmount: "100",
    });
    expect(entry.type).toBe("WITHDRAWAL");
  });

  it("rejects a non-positive contribution or withdrawal amount", () => {
    expect(() =>
      createContribution(owner, { portfolioId, effectiveDate: "2026-01-01", cashAmount: "0" }),
    ).toThrow(ValidationError);
    expect(() =>
      createWithdrawal(owner, { portfolioId, effectiveDate: "2026-01-01", cashAmount: "-5" }),
    ).toThrow(ValidationError);
  });

  it("creates a BUY that defaults fee to zero", () => {
    const entry = createBuy(owner, {
      portfolioId,
      effectiveDate: "2026-01-01",
      instrumentId,
      quantity: "10",
      unitPrice: "5",
    });
    expect(entry.fee.toPersistedString()).toBe("0");
  });

  it("creates a SELL with an explicit fee", () => {
    const entry = createSell(owner, {
      portfolioId,
      effectiveDate: "2026-01-01",
      instrumentId,
      quantity: "10",
      unitPrice: "5",
      fee: "1.5",
    });
    expect(entry.fee.toPersistedString()).toBe("1.5");
  });

  it("rejects non-positive quantity or unit price on a trade", () => {
    expect(() =>
      createBuy(owner, {
        portfolioId,
        effectiveDate: "2026-01-01",
        instrumentId,
        quantity: "0",
        unitPrice: "5",
      }),
    ).toThrow(ValidationError);
    expect(() =>
      createSell(owner, {
        portfolioId,
        effectiveDate: "2026-01-01",
        instrumentId,
        quantity: "1",
        unitPrice: "-1",
      }),
    ).toThrow(ValidationError);
  });

  it("rejects a negative fee", () => {
    expect(() =>
      createBuy(owner, {
        portfolioId,
        effectiveDate: "2026-01-01",
        instrumentId,
        quantity: "1",
        unitPrice: "1",
        fee: "-0.01",
      }),
    ).toThrow(ValidationError);
  });

  it("rejects an invalid effective date", () => {
    expect(() =>
      createContribution(owner, { portfolioId, effectiveDate: "not-a-date", cashAmount: "1" }),
    ).toThrow(ValidationError);
  });
});

describe("parseLedgerEntry", () => {
  it("rejects a contribution carrying trade fields", () => {
    let error: ValidationError | undefined;
    try {
      parseLedgerEntry(owner, {
        type: "CONTRIBUTION",
        portfolioId,
        effectiveDate: "2026-01-01",
        cashAmount: "100",
        instrumentId,
        quantity: "1",
      });
    } catch (caught) {
      error = caught as ValidationError;
    }
    expect(error).toBeInstanceOf(ValidationError);
    expect(error?.fieldErrors.instrumentId).toBeDefined();
    expect(error?.fieldErrors.quantity).toBeDefined();
  });

  it("rejects a buy missing required trade fields and names every missing field", () => {
    let error: ValidationError | undefined;
    try {
      parseLedgerEntry(owner, {
        type: "BUY",
        portfolioId,
        effectiveDate: "2026-01-01",
      });
    } catch (caught) {
      error = caught as ValidationError;
    }
    expect(error).toBeInstanceOf(ValidationError);
    expect(error?.fieldErrors.instrumentId).toBeDefined();
    expect(error?.fieldErrors.quantity).toBeDefined();
    expect(error?.fieldErrors.unitPrice).toBeDefined();
  });

  it("rejects a sell carrying a cash amount", () => {
    expect(() =>
      parseLedgerEntry(owner, {
        type: "SELL",
        portfolioId,
        effectiveDate: "2026-01-01",
        instrumentId,
        quantity: "1",
        unitPrice: "1",
        cashAmount: "5",
      }),
    ).toThrow(ValidationError);
  });

  it("rejects an unsupported type", () => {
    expect(() =>
      parseLedgerEntry(owner, {
        type: "DIVIDEND",
        portfolioId,
        effectiveDate: "2026-01-01",
      }),
    ).toThrow(ValidationError);
  });

  it("parses a well-formed BUY", () => {
    const entry = parseLedgerEntry(owner, {
      type: "BUY",
      portfolioId,
      effectiveDate: "2026-01-01",
      instrumentId,
      quantity: "10",
      unitPrice: "5",
    });
    expect(entry.type).toBe("BUY");
  });
});
