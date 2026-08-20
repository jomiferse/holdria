import { Badge } from "@/components/ui/badge";
import { formatEur } from "@/shared/domain/money";

import type { PortfolioAnalytics } from "../../application/portfolio-analytics";

/** Lists every open position with its units, cost, price, market value, and unrealized result (analytics spec: valuation and result). */
export function PositionsTable({ analytics }: { readonly analytics: PortfolioAnalytics }) {
  const { valuation, instrumentsById } = analytics;

  if (valuation.positions.length === 0) {
    return (
      <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
        No open positions yet. Record a buy to see it here.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl ring-1 ring-foreground/10">
      <table className="w-full text-left text-sm">
        <caption className="sr-only">Open positions and their current valuation</caption>
        <thead className="border-b bg-muted/50">
          <tr>
            <th scope="col" className="px-3 py-2 font-medium">Instrument</th>
            <th scope="col" className="px-3 py-2 font-medium">Units</th>
            <th scope="col" className="px-3 py-2 font-medium">Open cost</th>
            <th scope="col" className="px-3 py-2 font-medium">Price</th>
            <th scope="col" className="px-3 py-2 font-medium">Market value</th>
            <th scope="col" className="px-3 py-2 font-medium">Unrealized result</th>
          </tr>
        </thead>
        <tbody>
          {valuation.positions.map((position) => {
            const instrument = instrumentsById.get(position.instrumentId);
            const isPositive = position.unrealizedResult?.isPositive() ?? false;
            const isNegative = position.unrealizedResult?.isNegative() ?? false;
            return (
              <tr key={position.instrumentId} className="border-b last:border-b-0">
                <td className="px-3 py-2">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{instrument?.name ?? "Unknown instrument"}</span>
                    {instrument && <Badge variant="secondary">{instrument.type}</Badge>}
                  </div>
                </td>
                <td className="tabular-financial px-3 py-2">{position.units.value.toFixed(4)}</td>
                <td className="tabular-financial px-3 py-2">{formatEur(position.openCost)}</td>
                <td className="tabular-financial px-3 py-2">
                  {position.price.status === "priced" ? (
                    <span title={`Manual price as of ${position.price.effectiveDate}`}>
                      {position.price.price.toFixed(4)} EUR
                      <span className="ml-1 text-xs text-muted-foreground">as of {position.price.effectiveDate}</span>
                    </span>
                  ) : (
                    <Badge variant="outline">Unpriced</Badge>
                  )}
                </td>
                <td className="tabular-financial px-3 py-2">
                  {position.marketValue !== null ? formatEur(position.marketValue) : "—"}
                </td>
                <td
                  className={`tabular-financial px-3 py-2 ${
                    position.unrealizedResult === null
                      ? "text-muted-foreground"
                      : isPositive
                        ? "text-positive"
                        : isNegative
                          ? "text-negative"
                          : "text-neutral-financial"
                  }`}
                >
                  {position.unrealizedResult !== null ? formatEur(position.unrealizedResult) : "—"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
