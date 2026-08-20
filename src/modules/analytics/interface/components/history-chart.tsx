"use client";

import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { Badge } from "@/components/ui/badge";
import { formatEur } from "@/shared/domain/money";

/**
 * Plain, serializable view of one reconstructed historical point.
 *
 * `PortfolioSnapshot` carries `Money`/`Decimal` class instances inside
 * `valuation`, which the Server->Client Component boundary cannot
 * serialize ("Only plain objects ... can be passed to Client Components
 * from Server Components"). The Server Component page maps snapshots to
 * this DTO — plain strings/numbers only — before rendering `HistoryChart`.
 */
export interface HistoryPointView {
  readonly date: string;
  readonly status: "complete" | "incomplete";
  /** Rounded to display precision for the chart's numeric axis; `null` when incomplete. */
  readonly value: number | null;
  /** Pre-formatted EUR string for the table; `null` when incomplete. */
  readonly formattedValue: string | null;
}

/**
 * Chronological portfolio value chart (analytics spec: "Historical
 * evolution"). Only dates with a complete valuation are plotted as points
 * on the line; an incomplete date breaks the line rather than
 * interpolating or fabricating a value ("Early history lacks a price").
 * The table beneath is both the chart's accessible alternative and its
 * only view when every point is incomplete or there is a single point.
 */
export function HistoryChart({ points }: { readonly points: readonly HistoryPointView[] }) {
  if (points.length === 0) {
    return (
      <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
        No history to show yet. Record an operation to begin building it.
      </div>
    );
  }

  const hasCompletePoint = points.some((point) => point.value !== null);
  const incompleteDates = points.filter((point) => point.status === "incomplete").map((point) => point.date);

  return (
    <div className="flex flex-col gap-4">
      {hasCompletePoint && (
        <div className="h-64 w-full rounded-xl ring-1 ring-foreground/10" role="img" aria-label="Portfolio value over time">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={[...points]} margin={{ top: 12, right: 16, bottom: 4, left: 4 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} minTickGap={24} />
              <YAxis tick={{ fontSize: 11 }} width={72} tickFormatter={(value: number) => formatEur(value)} />
              <Tooltip
                formatter={(value) => (typeof value === "number" ? formatEur(value) : String(value ?? ""))}
                labelFormatter={(label) => `As of ${label}`}
              />
              <Line
                type="monotone"
                dataKey="value"
                stroke="var(--color-primary)"
                strokeWidth={2}
                dot={{ r: 3 }}
                connectNulls={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {incompleteDates.length > 0 && (
        <p className="text-sm text-muted-foreground">
          {incompleteDates.length === 1
            ? `${incompleteDates[0]} is marked incomplete below and omitted from the line: a held instrument had no eligible price that date.`
            : `${incompleteDates.length} dates are marked incomplete below and omitted from the line: a held instrument had no eligible price on those dates.`}
        </p>
      )}

      <div className="overflow-x-auto rounded-xl ring-1 ring-foreground/10">
        <table className="w-full text-left text-sm">
          <caption className="sr-only">Portfolio value by date, the chart&apos;s data in table form</caption>
          <thead className="border-b bg-muted/50">
            <tr>
              <th scope="col" className="px-3 py-2 font-medium">Date</th>
              <th scope="col" className="px-3 py-2 font-medium">Value</th>
            </tr>
          </thead>
          <tbody>
            {points.map((point) => (
              <tr key={point.date} className="border-b last:border-b-0">
                <td className="px-3 py-2">{point.date}</td>
                <td className="tabular-financial px-3 py-2">
                  {point.status === "complete" ? point.formattedValue : <Badge variant="outline">Incomplete</Badge>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
