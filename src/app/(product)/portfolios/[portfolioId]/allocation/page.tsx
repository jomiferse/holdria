import { requireVerifiedActor } from "@/modules/identity/application/actor";
import { AllocationView } from "@/modules/analytics/interface/components/allocation-view";
import { getPortfolioAnalyticsView } from "@/modules/analytics/interface/queries";

export default async function PortfolioAllocationPage({
  params,
}: {
  params: Promise<{ portfolioId: string }>;
}) {
  const { portfolioId } = await params;
  const actor = await requireVerifiedActor();
  const analytics = await getPortfolioAnalyticsView(actor.userId, portfolioId);

  const instrumentNames = analytics.valuation.unpricedInstrumentIds.map(
    (id) => analytics.instrumentsById.get(id)?.name ?? "an instrument",
  );

  return (
    <AllocationView allocation={analytics.allocation} portfolioId={portfolioId} instrumentNames={instrumentNames} />
  );
}
