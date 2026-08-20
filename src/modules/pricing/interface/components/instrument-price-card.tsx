import { Badge } from "@/components/ui/badge";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AddPriceObservationDialog } from "@/modules/pricing/interface/components/add-price-observation-dialog";
import { DeletePriceObservationButton } from "@/modules/pricing/interface/components/delete-price-observation-button";
import { EditPriceObservationDialog } from "@/modules/pricing/interface/components/edit-price-observation-dialog";
import { ManualPriceBadge } from "@/modules/pricing/interface/components/manual-price-badge";
import type { InstrumentWithPriceObservations } from "@/modules/pricing/interface/queries";

/** Lists one instrument's manual price observations and the actions to add, correct, or remove one. */
export function InstrumentPriceCard({ instrument, observations }: InstrumentWithPriceObservations) {
  return (
    <Card>
      <CardHeader>
        {/* `CardTitle` is a styled `div`, not a semantic heading (see
            `components/ui/card.tsx`) — wrap it in an actual `h2` so the
            prices list is navigable by heading, matching the same pattern
            used on the portfolios list page. */}
        <CardTitle>
          <h2 className="contents">{instrument.name}</h2>
        </CardTitle>
        <CardAction>
          <AddPriceObservationDialog instrumentId={instrument.id} instrumentName={instrument.name} />
        </CardAction>
      </CardHeader>
      <CardContent>
        {observations.length === 0 ? (
          <p className="text-sm text-muted-foreground">No manual prices recorded yet.</p>
        ) : (
          <ul className="grid gap-2" aria-label={`Manual prices for ${instrument.name}`}>
            {observations.map((observation) => (
              <li key={observation.id} className="flex flex-wrap items-center justify-between gap-2 border-b pb-2 last:border-b-0 last:pb-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium tabular-nums">{observation.price.toFixed(4)} EUR</span>
                  <ManualPriceBadge effectiveDate={observation.effectiveDate} />
                </div>
                <div className="flex items-center gap-1">
                  <EditPriceObservationDialog
                    instrumentId={instrument.id}
                    observation={{
                      id: observation.id,
                      price: observation.price.toFixed(4),
                      effectiveDate: observation.effectiveDate,
                    }}
                  />
                  <DeletePriceObservationButton id={observation.id} effectiveDate={observation.effectiveDate} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

/** Type badge for the instrument kind, shown alongside its name where the page groups by type. */
export function InstrumentTypeBadge({ type }: { readonly type: string }) {
  return <Badge variant="secondary">{type}</Badge>;
}
