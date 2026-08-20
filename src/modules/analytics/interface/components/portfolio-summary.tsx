import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatEur } from "@/shared/domain/money";

import type { ModifiedDietzResult } from "../../domain/modified-dietz";
import type { PortfolioAnalytics } from "../../application/portfolio-analytics";
import { formatPercent } from "../format";
import { MissingPriceNote } from "./missing-price-note";

function resultTone(isPositive: boolean, isNegative: boolean): string {
  if (isPositive) return "text-positive";
  if (isNegative) return "text-negative";
  return "text-neutral-financial";
}

/**
 * Portfolio summary: current value, absolute result, and Modified Dietz
 * return since inception (analytics spec: "Current portfolio valuation",
 * "Absolute portfolio result", "Modified Dietz return"). Every figure that
 * depends on a missing price is hidden with an explanation rather than
 * shown as zero.
 */
export function PortfolioSummary({
  analytics,
  modifiedDietz,
  instrumentNames,
}: {
  readonly analytics: PortfolioAnalytics;
  readonly modifiedDietz: ModifiedDietzResult;
  readonly instrumentNames: readonly string[];
}) {
  const { valuation, result } = analytics;

  return (
    <div className="flex flex-col gap-4">
      {valuation.status === "incomplete" && <MissingPriceNote instrumentNames={instrumentNames} />}

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">Portfolio value</CardTitle>
          </CardHeader>
          <CardContent>
            {valuation.totalValue !== null ? (
              <p className="tabular-financial text-2xl font-semibold" data-testid="portfolio-total-value">
                {formatEur(valuation.totalValue)}
              </p>
            ) : (
              <p className="text-2xl font-semibold text-muted-foreground" data-testid="portfolio-total-value">
                Unavailable
              </p>
            )}
            <p className="text-xs text-muted-foreground">
              as of {valuation.valuationDate} · cash {formatEur(valuation.cash)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">Absolute result</CardTitle>
          </CardHeader>
          <CardContent>
            {result.absoluteResult !== null ? (
              <p
                className={`tabular-financial text-2xl font-semibold ${resultTone(result.absoluteResult.isPositive(), result.absoluteResult.isNegative())}`}
                data-testid="portfolio-absolute-result"
              >
                {formatEur(result.absoluteResult)}
              </p>
            ) : (
              <p className="text-2xl font-semibold text-muted-foreground" data-testid="portfolio-absolute-result">
                Unavailable
              </p>
            )}
            <p className="text-xs text-muted-foreground">Realized {formatEur(result.realizedResult)}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">Return since inception</CardTitle>
          </CardHeader>
          <CardContent>
            {modifiedDietz.status === "available" ? (
              <p
                className={`tabular-financial text-2xl font-semibold ${resultTone(modifiedDietz.returnRate.isPositive(), modifiedDietz.returnRate.isNegative())}`}
                data-testid="portfolio-return"
              >
                {formatPercent(modifiedDietz.returnRate)}
              </p>
            ) : (
              <p className="text-2xl font-semibold text-muted-foreground" data-testid="portfolio-return">
                Unavailable
              </p>
            )}
            <p className="text-xs text-muted-foreground">
              {modifiedDietz.status === "available"
                ? `Modified Dietz, ${modifiedDietz.periodStart} to ${modifiedDietz.periodEnd}`
                : modifiedDietz.reason}
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
