import type { Decimal } from "@/shared/domain/decimal";
import { Money } from "@/shared/domain/money";

/** One external cash flow within a Modified Dietz period. Positive for a contribution, negative for a withdrawal. */
export interface ExternalCashFlow {
  readonly date: string;
  readonly amount: Money;
}

export type ModifiedDietzResult =
  | {
      readonly status: "available";
      readonly periodStart: string;
      readonly periodEnd: string;
      /** Non-annualized return as a decimal fraction (e.g. `0.0532` = 5.32%). */
      readonly returnRate: Decimal;
    }
  | {
      readonly status: "unavailable";
      readonly periodStart: string;
      readonly periodEnd: string;
      readonly reason: string;
    };

/** Whole calendar days between two `YYYY-MM-DD` dates (`to - from`), computed in UTC so no timezone shifts the count. */
function daysBetween(from: string, to: string): number {
  const [fy, fm, fd] = from.split("-").map(Number);
  const [ty, tm, td] = to.split("-").map(Number);
  const fromMs = Date.UTC(fy, fm - 1, fd);
  const toMs = Date.UTC(ty, tm - 1, td);
  return Math.round((toMs - fromMs) / 86_400_000);
}

/**
 * Non-annualized Modified Dietz return (design.md decision 8):
 *
 * ```text
 * (ending value - beginning value - sum(external cash flows))
 * ----------------------------------------------------------------
 * (beginning value + sum(weight for each flow * external cash flow))
 * ```
 *
 * `weight` for a flow is the fraction of the period it remained invested:
 * `(periodDays - daysFromStart) / periodDays`, so a flow on `periodStart`
 * carries weight `1` and a flow on `periodEnd` carries weight `0`. When
 * `periodStart` and `periodEnd` are the same date (`periodDays === 0`,
 * e.g. a since-inception period whose first contribution and valuation
 * both land on day one), every flow is treated as fully invested for the
 * period (`weight = 1`), matching the zero-length-period convention.
 *
 * `beginningValue`/`endingValue` are `null` when the corresponding
 * valuation is incomplete (a required price was missing). Per "Return
 * cannot be calculated reliably", a missing valuation or a zero/negative
 * denominator makes the result explicitly `unavailable` with a reason —
 * never zero or a misleading percentage.
 *
 * The caller is responsible for period semantics: `beginningValue` must
 * exclude flows dated exactly `periodStart` (so a flow on that date is
 * counted once, as a weighted flow, not baked into the beginning
 * balance), and `flows` must include every CONTRIBUTION/WITHDRAWAL dated
 * from `periodStart` through `periodEnd` inclusive. This makes "since
 * inception" (periodStart = first contribution date, beginning value
 * zero because nothing preceded it) fall out of the general rule without
 * a special case.
 */
export function calculateModifiedDietz(
  periodStart: string,
  periodEnd: string,
  beginningValue: Money | null,
  endingValue: Money | null,
  flows: readonly ExternalCashFlow[],
): ModifiedDietzResult {
  if (periodStart > periodEnd) {
    return { status: "unavailable", periodStart, periodEnd, reason: "The period start must be on or before its end." };
  }

  if (beginningValue === null || endingValue === null) {
    return {
      status: "unavailable",
      periodStart,
      periodEnd,
      reason: "Return is unavailable because a required price is missing for this period.",
    };
  }

  const periodDays = daysBetween(periodStart, periodEnd);

  let externalFlowsSum = Money.zero();
  let weightedFlowsSum = Money.zero();

  for (const flow of flows) {
    externalFlowsSum = externalFlowsSum.plus(flow.amount);
    const weight = periodDays === 0 ? 1 : (periodDays - daysBetween(periodStart, flow.date)) / periodDays;
    weightedFlowsSum = weightedFlowsSum.plus(flow.amount.times(weight));
  }

  const denominator = beginningValue.plus(weightedFlowsSum);

  if (!denominator.isPositive()) {
    return {
      status: "unavailable",
      periodStart,
      periodEnd,
      reason: "Return is unavailable because the calculation base is zero or negative.",
    };
  }

  const numerator = endingValue.minus(beginningValue).minus(externalFlowsSum);
  const returnRate = numerator.amount.dividedBy(denominator.amount);

  return { status: "available", periodStart, periodEnd, returnRate };
}
