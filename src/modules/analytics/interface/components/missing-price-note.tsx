import Link from "next/link";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { TriangleAlertIcon } from "lucide-react";

/**
 * Explains why a valuation, result, allocation, or return is incomplete
 * instead of silently showing zero (analytics spec: "An open position
 * lacks a price" / "Allocation is incomplete" / pricing spec: "no
 * eligible price exists").
 */
export function MissingPriceNote({ instrumentNames, portfolioId }: { instrumentNames: readonly string[]; portfolioId: string }) {
  return (
    <Alert>
      <TriangleAlertIcon />
      <AlertTitle>Some figures are incomplete</AlertTitle>
      <AlertDescription>
        <p>
          {instrumentNames.length === 1
            ? `${instrumentNames[0]} has no recorded price on or before this date.`
            : `These instruments have no recorded price on or before this date: ${instrumentNames.join(", ")}.`}{" "}
          Totals that depend on it are hidden rather than shown as zero or an estimate.
        </p>
        <Link href={`/portfolios/${portfolioId}/prices`} className="font-medium underline underline-offset-2">
          Record a price
        </Link>
      </AlertDescription>
    </Alert>
  );
}
