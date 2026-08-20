import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { getCurrentUserId } from "@/modules/identity/application/get-current-user-id";
import { InstrumentPriceCard } from "@/modules/pricing/interface/components/instrument-price-card";
import { getInstrumentsWithPriceObservations } from "@/modules/pricing/interface/queries";
import { UnauthorizedError } from "@/shared/domain/errors";

/**
 * Manual price list and correction experience (pricing spec: "Provenance
 * is visible", "One manual price per instrument date"). Every price shown
 * here carries its effective date and "Manual" source — never presented
 * as a live quote.
 */
export default async function PricesPage() {
  let ownerId;
  try {
    ownerId = await getCurrentUserId();
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return (
        <div className="mx-auto max-w-2xl p-6">
          <Alert>
            <AlertTitle>Sign in required</AlertTitle>
            <AlertDescription>Sign in to manage manual instrument prices.</AlertDescription>
          </Alert>
        </div>
      );
    }
    throw error;
  }

  const instrumentsWithPrices = await getInstrumentsWithPriceObservations(ownerId);

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 p-6">
      <header>
        <h1 className="font-heading text-xl font-semibold">Manual prices</h1>
        <p className="text-sm text-muted-foreground">
          Record dated prices for your instruments. Valuations use the most recent eligible price on or before each
          date and always show its date and source.
        </p>
      </header>

      {instrumentsWithPrices.length === 0 ? (
        <Alert>
          <AlertTitle>No instruments yet</AlertTitle>
          <AlertDescription>Add an instrument before recording a price for it.</AlertDescription>
        </Alert>
      ) : (
        <div className="grid gap-4">
          {instrumentsWithPrices.map(({ instrument, observations }) => (
            <InstrumentPriceCard key={instrument.id} instrument={instrument} observations={observations} />
          ))}
        </div>
      )}
    </div>
  );
}
