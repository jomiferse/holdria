import { Badge } from "@/components/ui/badge";
import type { Decimal } from "@/shared/domain/decimal";
import { formatEur, type Money } from "@/shared/domain/money";

import type { AllocationResult } from "../../domain/allocation";
import { formatPercent } from "../format";
import { MissingPriceNote } from "./missing-price-note";

/**
 * Allocation by instrument and instrument type (analytics spec: "Portfolio
 * allocation"). Rendered as an accessible data table with a magnitude bar
 * per row rather than a pie chart: weight is read directly from the
 * numbers, the bar's width alone conveys magnitude (never color-alone
 * identity), and no categorical palette needs validating for an arbitrary
 * number of instruments.
 */
export function AllocationView({
  allocation,
  instrumentNames,
}: {
  readonly allocation: AllocationResult;
  readonly instrumentNames: readonly string[];
}) {
  if (allocation.status === "incomplete") {
    return <MissingPriceNote instrumentNames={instrumentNames} />;
  }

  if (allocation.byInstrument.length === 0) {
    return (
      <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
        No open positions to allocate yet.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <section aria-labelledby="allocation-by-instrument-heading" className="flex flex-col gap-2">
        <h2 id="allocation-by-instrument-heading" className="text-sm font-medium text-muted-foreground">
          By instrument
        </h2>
        <AllocationTable
          rows={allocation.byInstrument.map((entry) => ({
            key: entry.instrumentId,
            label: entry.instrumentName,
            badge: entry.instrumentType,
            marketValue: entry.marketValue,
            weight: entry.weight,
          }))}
        />
      </section>

      <section aria-labelledby="allocation-by-type-heading" className="flex flex-col gap-2">
        <h2 id="allocation-by-type-heading" className="text-sm font-medium text-muted-foreground">
          By instrument type
        </h2>
        <AllocationTable
          rows={allocation.byType.map((entry) => ({
            key: entry.instrumentType,
            label: entry.instrumentType,
            marketValue: entry.marketValue,
            weight: entry.weight,
          }))}
        />
      </section>
    </div>
  );
}

interface AllocationRow {
  readonly key: string;
  readonly label: string;
  readonly badge?: string;
  readonly marketValue: Money;
  readonly weight: Decimal;
}

function AllocationTable({ rows }: { readonly rows: readonly AllocationRow[] }) {
  return (
    <div className="overflow-x-auto rounded-xl ring-1 ring-foreground/10">
      <table className="w-full text-left text-sm">
        <thead className="border-b bg-muted/50">
          <tr>
            <th scope="col" className="px-3 py-2 font-medium">Name</th>
            <th scope="col" className="px-3 py-2 font-medium">Market value</th>
            <th scope="col" className="px-3 py-2 font-medium">Weight</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const percent = Number(row.weight.times(100).toFixed(2));
            return (
              <tr key={row.key} className="border-b last:border-b-0">
                <td className="px-3 py-2">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{row.label}</span>
                    {row.badge && <Badge variant="secondary">{row.badge}</Badge>}
                  </div>
                </td>
                <td className="tabular-financial px-3 py-2">{formatEur(row.marketValue)}</td>
                <td className="px-3 py-2">
                  <div className="flex items-center gap-2">
                    <div
                      className="h-2 min-w-8 flex-1 rounded-full bg-muted"
                      role="img"
                      aria-label={`${formatPercent(row.weight)} of invested market value`}
                    >
                      <div
                        className="h-2 rounded-full bg-primary"
                        style={{ width: `${Math.min(100, Math.max(0, percent))}%` }}
                      />
                    </div>
                    <span className="tabular-financial w-16 shrink-0 text-right">{formatPercent(row.weight)}</span>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
