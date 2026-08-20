import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { requireVerifiedActor } from "@/modules/identity/application/actor";
import { getOperationsPageData, type LedgerEntryView } from "@/modules/transactions/interface/queries";
import { formatEur } from "@/shared/domain/money";
import { toDecimal } from "@/shared/domain/decimal";
import { ContributeAndInvestForm } from "./contribute-and-invest-form";
import { LedgerDeleteButton } from "./ledger-delete-button";
import { LedgerForm } from "./ledger-form";

function describeOperation(entry: LedgerEntryView): string {
  return `${entry.type} on ${entry.effectiveDate}`;
}

export default async function PortfolioOperationsPage({
  params,
}: {
  params: Promise<{ portfolioId: string }>;
}) {
  const { portfolioId } = await params;
  const actor = await requireVerifiedActor();
  const { entries, instruments } = await getOperationsPageData(actor.userId, portfolioId);
  const instrumentNames = new Map(instruments.map((instrument) => [instrument.id, instrument.name]));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Every contribution, withdrawal, buy, and sell in this portfolio, oldest first.
        </p>
        <div className="flex gap-2">
          <ContributeAndInvestForm portfolioId={portfolioId} instruments={instruments} />
          <LedgerForm portfolioId={portfolioId} instruments={instruments} trigger={<Button>Add operation</Button>} />
        </div>
      </div>

      {entries.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed p-8 text-center">
          <p className="text-sm text-muted-foreground">
            No operations recorded yet. Start with a contribution, or contribute and invest in one step.
          </p>
          <div className="flex gap-2">
            <ContributeAndInvestForm portfolioId={portfolioId} instruments={instruments} />
            <LedgerForm
              portfolioId={portfolioId}
              instruments={instruments}
              trigger={<Button variant="outline">Add your first operation</Button>}
            />
          </div>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl ring-1 ring-foreground/10">
          <table className="w-full text-left text-sm">
            <caption className="sr-only">Ledger operations for this portfolio</caption>
            <thead className="border-b bg-muted/50">
              <tr>
                <th scope="col" className="px-3 py-2 font-medium">Date</th>
                <th scope="col" className="px-3 py-2 font-medium">Type</th>
                <th scope="col" className="px-3 py-2 font-medium">Instrument</th>
                <th scope="col" className="px-3 py-2 font-medium">Amount</th>
                <th scope="col" className="px-3 py-2 font-medium">Note</th>
                <th scope="col" className="px-3 py-2 font-medium">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <tr key={entry.id} className="border-b last:border-b-0">
                  <td className="tabular-financial px-3 py-2">{entry.effectiveDate}</td>
                  <td className="px-3 py-2">
                    <Badge variant="secondary">{entry.type}</Badge>
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {entry.type === "BUY" || entry.type === "SELL" ? instrumentNames.get(entry.instrumentId) ?? "—" : "—"}
                  </td>
                  <td className="tabular-financial px-3 py-2">
                    {entry.type === "CONTRIBUTION" || entry.type === "WITHDRAWAL"
                      ? formatEur(entry.cashAmount)
                      : `${toDecimal(entry.quantity).toFixed(4)} × ${formatEur(entry.unitPrice)}${toDecimal(entry.fee).isPositive() ? ` + ${formatEur(entry.fee)} fee` : ""}`}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">{entry.note || "—"}</td>
                  <td className="px-3 py-2">
                    <div className="flex justify-end gap-2">
                      <LedgerForm
                        portfolioId={portfolioId}
                        instruments={instruments}
                        entry={entry}
                        trigger={
                          <Button variant="outline" size="sm" aria-label={`Edit ${describeOperation(entry)}`}>
                            Edit
                          </Button>
                        }
                      />
                      <LedgerDeleteButton id={entry.id} portfolioId={portfolioId} label={describeOperation(entry)} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
