import { describe, expect, it } from "vitest";

import { InvariantViolationError } from "@/shared/domain/errors";
import { toUserId } from "@/shared/domain/user-id";

import { createBuy, createContribution, createSell, createWithdrawal } from "./ledger-entry";
import type { LedgerEntry } from "./ledger-entry";
import { reduceLedger } from "./ledger-reducer";

const owner = toUserId("00000000-0000-0000-0000-000000000001");
const portfolioId = "10000000-0000-0000-0000-000000000001";
const instrumentA = "20000000-0000-0000-0000-000000000001";
const instrumentB = "20000000-0000-0000-0000-000000000002";

/** Attaches a sequence, since `reduceLedger` requires every entry to be ordered. */
function seq<T extends LedgerEntry>(entry: T, sequence: number): T {
  return { ...entry, sequence: BigInt(sequence) };
}

describe("reduceLedger", () => {
  it("golden case: contribution then a single buy", () => {
    const entries = [
      seq(createContribution(owner, { portfolioId, effectiveDate: "2026-01-01", cashAmount: "1000" }), 1),
      seq(
        createBuy(owner, {
          portfolioId,
          effectiveDate: "2026-01-02",
          instrumentId: instrumentA,
          quantity: "10",
          unitPrice: "50",
          fee: "5",
        }),
        2,
      ),
    ];

    const projection = reduceLedger(entries);

    // cash = 1000 - (10*50 + 5) = 495
    expect(projection.cash.toPersistedString()).toBe("495");
    const position = projection.positions.get(instrumentA);
    expect(position?.units.toPersistedString()).toBe("10");
    expect(position?.openCost.toPersistedString()).toBe("505");
    expect(position?.realizedResult.toPersistedString()).toBe("0");
  });

  it("golden case: multiple buys compute a weighted-average open cost including fees", () => {
    const entries = [
      seq(createContribution(owner, { portfolioId, effectiveDate: "2026-01-01", cashAmount: "2000" }), 1),
      seq(
        createBuy(owner, {
          portfolioId,
          effectiveDate: "2026-01-02",
          instrumentId: instrumentA,
          quantity: "10",
          unitPrice: "100",
          fee: "5",
        }),
        2,
      ),
      seq(
        createBuy(owner, {
          portfolioId,
          effectiveDate: "2026-01-03",
          instrumentId: instrumentA,
          quantity: "5",
          unitPrice: "110",
          fee: "2",
        }),
        3,
      ),
    ];

    const projection = reduceLedger(entries);

    // buy 1 cost = 1005, buy 2 cost = 552, total open cost = 1557 over 15 units
    const position = projection.positions.get(instrumentA);
    expect(position?.units.toPersistedString()).toBe("15");
    expect(position?.openCost.toPersistedString()).toBe("1557");
    expect(projection.cash.toPersistedString()).toBe("443"); // 2000 - 1005 - 552
  });

  it("golden case: a partial sell uses the weighted-average cost and records realized result", () => {
    const entries = [
      seq(createContribution(owner, { portfolioId, effectiveDate: "2026-01-01", cashAmount: "2000" }), 1),
      seq(
        createBuy(owner, {
          portfolioId,
          effectiveDate: "2026-01-02",
          instrumentId: instrumentA,
          quantity: "10",
          unitPrice: "100",
          fee: "5",
        }),
        2,
      ),
      seq(
        createBuy(owner, {
          portfolioId,
          effectiveDate: "2026-01-03",
          instrumentId: instrumentA,
          quantity: "5",
          unitPrice: "110",
          fee: "2",
        }),
        3,
      ),
      seq(
        createSell(owner, {
          portfolioId,
          effectiveDate: "2026-01-04",
          instrumentId: instrumentA,
          quantity: "6",
          unitPrice: "120",
          fee: "3",
        }),
        4,
      ),
    ];

    const projection = reduceLedger(entries);

    // average cost/unit = 1557/15 = 103.8; cost removed = 6 * 103.8 = 622.8
    // proceeds = 6*120 - 3 = 717; realized = 717 - 622.8 = 94.2
    const position = projection.positions.get(instrumentA);
    expect(position?.units.toPersistedString()).toBe("9");
    expect(position?.openCost.toPersistedString()).toBe("934.2");
    expect(position?.realizedResult.toPersistedString()).toBe("94.2");
    expect(projection.realizedResult.toPersistedString()).toBe("94.2");
    expect(projection.cash.toPersistedString()).toBe("1160"); // 443 + 717
  });

  it("golden case: fully selling a position zeroes open cost exactly, without division residue", () => {
    const entries = [
      seq(createContribution(owner, { portfolioId, effectiveDate: "2026-01-01", cashAmount: "1000" }), 1),
      seq(
        createBuy(owner, {
          portfolioId,
          effectiveDate: "2026-01-02",
          instrumentId: instrumentA,
          quantity: "3",
          unitPrice: "100",
        }),
        2,
      ),
      seq(
        createSell(owner, {
          portfolioId,
          effectiveDate: "2026-01-03",
          instrumentId: instrumentA,
          quantity: "3",
          unitPrice: "110",
        }),
        3,
      ),
    ];

    const projection = reduceLedger(entries);
    const position = projection.positions.get(instrumentA);
    expect(position?.units.toPersistedString()).toBe("0");
    expect(position?.openCost.toPersistedString()).toBe("0");
    expect(position?.realizedResult.toPersistedString()).toBe("30"); // 330 proceeds - 300 cost
  });

  it("tracks independent positions per instrument", () => {
    const entries = [
      seq(createContribution(owner, { portfolioId, effectiveDate: "2026-01-01", cashAmount: "1000" }), 1),
      seq(
        createBuy(owner, {
          portfolioId,
          effectiveDate: "2026-01-02",
          instrumentId: instrumentA,
          quantity: "1",
          unitPrice: "100",
        }),
        2,
      ),
      seq(
        createBuy(owner, {
          portfolioId,
          effectiveDate: "2026-01-02",
          instrumentId: instrumentB,
          quantity: "2",
          unitPrice: "50",
        }),
        3,
      ),
    ];

    const projection = reduceLedger(entries);
    expect(projection.positions.get(instrumentA)?.units.toPersistedString()).toBe("1");
    expect(projection.positions.get(instrumentB)?.units.toPersistedString()).toBe("2");
  });

  it("orders same-effective-date entries by sequence, not by array order, and is deterministic", () => {
    const contribution = seq(
      createContribution(owner, { portfolioId, effectiveDate: "2026-01-01", cashAmount: "1000" }),
      1,
    );
    const buy = seq(
      createBuy(owner, {
        portfolioId,
        effectiveDate: "2026-01-01",
        instrumentId: instrumentA,
        quantity: "1",
        unitPrice: "100",
      }),
      2,
    );

    // Passed in reverse (BUY before CONTRIBUTION in the array); sequence
    // must still put the contribution first, so the buy succeeds.
    const projection = reduceLedger([buy, contribution]);
    expect(projection.cash.toPersistedString()).toBe("900");

    // Repeated calculation over the same input produces the same result.
    const again = reduceLedger([buy, contribution]);
    expect(again.cash.toPersistedString()).toBe(projection.cash.toPersistedString());
  });

  it("rejects a withdrawal that would make cash negative", () => {
    const entries = [
      seq(createContribution(owner, { portfolioId, effectiveDate: "2026-01-01", cashAmount: "100" }), 1),
      seq(createWithdrawal(owner, { portfolioId, effectiveDate: "2026-01-02", cashAmount: "150" }), 2),
    ];
    expect(() => reduceLedger(entries)).toThrow(InvariantViolationError);
  });

  it("rejects a buy that would make cash negative", () => {
    const entries = [
      seq(createContribution(owner, { portfolioId, effectiveDate: "2026-01-01", cashAmount: "100" }), 1),
      seq(
        createBuy(owner, {
          portfolioId,
          effectiveDate: "2026-01-02",
          instrumentId: instrumentA,
          quantity: "10",
          unitPrice: "50",
        }),
        2,
      ),
    ];
    expect(() => reduceLedger(entries)).toThrow(InvariantViolationError);
  });

  it("rejects a sell that would make held units negative", () => {
    const entries = [
      seq(createContribution(owner, { portfolioId, effectiveDate: "2026-01-01", cashAmount: "1000" }), 1),
      seq(
        createBuy(owner, {
          portfolioId,
          effectiveDate: "2026-01-02",
          instrumentId: instrumentA,
          quantity: "5",
          unitPrice: "100",
        }),
        2,
      ),
      seq(
        createSell(owner, {
          portfolioId,
          effectiveDate: "2026-01-03",
          instrumentId: instrumentA,
          quantity: "6",
          unitPrice: "100",
        }),
        3,
      ),
    ];
    expect(() => reduceLedger(entries)).toThrow(InvariantViolationError);
  });

  it("rejects selling an instrument with no position at all", () => {
    const entries = [
      seq(createContribution(owner, { portfolioId, effectiveDate: "2026-01-01", cashAmount: "1000" }), 1),
      seq(
        createSell(owner, {
          portfolioId,
          effectiveDate: "2026-01-02",
          instrumentId: instrumentA,
          quantity: "1",
          unitPrice: "100",
        }),
        2,
      ),
    ];
    expect(() => reduceLedger(entries)).toThrow(InvariantViolationError);
  });

  it("golden case: a repeating-decimal average cost still fully zeroes on a full sell", () => {
    // 100 / 3 = 33.333...; decimal.js retains far more precision than a
    // JS number could, and a full sell must still zero openCost exactly
    // (no residue) rather than leaving a rounding artifact.
    const entries = [
      seq(createContribution(owner, { portfolioId, effectiveDate: "2026-01-01", cashAmount: "1000" }), 1),
      seq(
        createBuy(owner, {
          portfolioId,
          effectiveDate: "2026-01-02",
          instrumentId: instrumentA,
          quantity: "3",
          unitPrice: "33.333333333333333333",
        }),
        2,
      ),
      seq(
        createSell(owner, {
          portfolioId,
          effectiveDate: "2026-01-03",
          instrumentId: instrumentA,
          quantity: "3",
          unitPrice: "40",
        }),
        3,
      ),
    ];

    const projection = reduceLedger(entries);
    const position = projection.positions.get(instrumentA);
    expect(position?.units.toPersistedString()).toBe("0");
    expect(position?.openCost.toPersistedString()).toBe("0");
  });

  it("invariant: cash and units never go negative across a long, randomly-ordered but valid history", () => {
    // Build a ledger that stays valid by construction (each buy/sell/withdrawal
    // is sized against the running state before creating the entry), pass the
    // resulting entries through reduceLedger, and assert every intermediate
    // prefix satisfies the same invariant reduceLedger itself enforces.
    let sequence = 1;
    let cash = 0;
    let units = 0;
    const entries: LedgerEntry[] = [];
    const dates = ["2026-01-01", "2026-01-02", "2026-01-03", "2026-01-04", "2026-01-05"];

    for (const date of dates) {
      entries.push(
        seq(createContribution(owner, { portfolioId, effectiveDate: date, cashAmount: "100" }), sequence++),
      );
      cash += 100;

      if (cash >= 20) {
        entries.push(
          seq(
            createBuy(owner, {
              portfolioId,
              effectiveDate: date,
              instrumentId: instrumentA,
              quantity: "2",
              unitPrice: "10",
            }),
            sequence++,
          ),
        );
        cash -= 20;
        units += 2;
      }

      if (units >= 1) {
        entries.push(
          seq(
            createSell(owner, {
              portfolioId,
              effectiveDate: date,
              instrumentId: instrumentA,
              quantity: "1",
              unitPrice: "11",
            }),
            sequence++,
          ),
        );
        cash += 11;
        units -= 1;
      }
    }

    // Every prefix of this valid history must replay without throwing.
    for (let end = 1; end <= entries.length; end += 1) {
      expect(() => reduceLedger(entries.slice(0, end))).not.toThrow();
    }

    const finalProjection = reduceLedger(entries);
    expect(finalProjection.cash.isNegative()).toBe(false);
    expect(finalProjection.positions.get(instrumentA)?.units.isNegative()).toBe(false);
  });

  it("returns an empty projection for no entries", () => {
    const projection = reduceLedger([]);
    expect(projection.cash.isZero()).toBe(true);
    expect(projection.positions.size).toBe(0);
  });
});
