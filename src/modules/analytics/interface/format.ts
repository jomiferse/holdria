import type { Decimal } from "@/shared/domain/decimal";

/** Centralized percentage display for analytics (mirrors `formatEur`'s role for money): calculation code never formats, presentation always goes through here. */
export function formatPercent(rate: Decimal): string {
  return `${rate.times(100).toFixed(2)}%`;
}
