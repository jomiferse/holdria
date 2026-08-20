import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { requireVerifiedActor } from "@/modules/identity/application/actor";
import { listInstruments } from "@/modules/instruments/application/queries";
import { drizzleInstrumentRepository } from "@/modules/instruments/infrastructure/drizzle-instrument-repository";
import { InstrumentForm } from "./instrument-form";
import { InstrumentDeleteButton } from "./instrument-delete-button";

export default async function InstrumentsPage() {
  const actor = await requireVerifiedActor();
  const instruments = await listInstruments({ repository: drizzleInstrumentRepository }, actor);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Instruments are shared across every portfolio you own.
        </p>
        <InstrumentForm trigger={<Button>Add instrument</Button>} />
      </div>

      {instruments.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed p-8 text-center">
          <p className="text-sm text-muted-foreground">
            No instruments yet. Add a fund, ETF, or stock to start recording operations.
          </p>
          <InstrumentForm trigger={<Button variant="outline">Add your first instrument</Button>} />
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl ring-1 ring-foreground/10">
          <table className="w-full text-left text-sm">
            <thead className="border-b bg-muted/50">
              <tr>
                <th scope="col" className="px-3 py-2 font-medium">
                  Name
                </th>
                <th scope="col" className="px-3 py-2 font-medium">
                  Type
                </th>
                <th scope="col" className="px-3 py-2 font-medium">
                  ISIN
                </th>
                <th scope="col" className="px-3 py-2 font-medium">
                  Ticker / market
                </th>
                <th scope="col" className="px-3 py-2 font-medium">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {instruments.map((instrument) => (
                <tr key={instrument.id} className="border-b last:border-b-0">
                  <td className="px-3 py-2">{instrument.name}</td>
                  <td className="px-3 py-2">
                    <Badge variant="secondary">{instrument.type}</Badge>
                  </td>
                  <td className="px-3 py-2 font-mono text-xs">{instrument.isin ?? "—"}</td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {instrument.ticker ? `${instrument.ticker}${instrument.market ? ` · ${instrument.market}` : ""}` : "—"}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex justify-end gap-2">
                      <InstrumentForm
                        instrument={instrument}
                        trigger={
                          <Button variant="outline" size="sm">
                            Edit
                          </Button>
                        }
                      />
                      <InstrumentDeleteButton instrument={instrument} />
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
