import { requireVerifiedActor } from "@/modules/identity/application/actor";
import { getPortfolio } from "@/modules/portfolio/application/queries";
import { drizzlePortfolioRepository } from "@/modules/portfolio/infrastructure/drizzle-portfolio-repository";
import { toPortfolioId } from "@/modules/portfolio/domain/portfolio";
import { PortfolioSummary } from "@/modules/analytics/interface/components/portfolio-summary";
import { PositionsTable } from "@/modules/analytics/interface/components/positions-table";
import { getPortfolioAnalyticsView, getPortfolioReturnView } from "@/modules/analytics/interface/queries";

export default async function PortfolioSummaryPage({
  params,
}: {
  params: Promise<{ portfolioId: string }>;
}) {
  const { portfolioId } = await params;
  const actor = await requireVerifiedActor();
  const portfolio = await getPortfolio(
    { repository: drizzlePortfolioRepository },
    actor,
    toPortfolioId(portfolioId),
  );

  const [analytics, modifiedDietz] = await Promise.all([
    getPortfolioAnalyticsView(actor.userId, portfolioId),
    getPortfolioReturnView(actor.userId, portfolioId),
  ]);

  const instrumentNames = analytics.valuation.unpricedInstrumentIds.map(
    (id) => analytics.instrumentsById.get(id)?.name ?? "an instrument",
  );

  return (
    <div className="flex flex-col gap-6">
      <dl className="grid max-w-sm grid-cols-2 gap-x-4 gap-y-2 text-sm">
        <dt className="text-muted-foreground">Base currency</dt>
        <dd>{portfolio.currency}</dd>
        <dt className="text-muted-foreground">Created</dt>
        <dd>{portfolio.createdAt.toLocaleDateString()}</dd>
      </dl>

      <PortfolioSummary analytics={analytics} modifiedDietz={modifiedDietz} instrumentNames={instrumentNames} />

      <div>
        <h2 className="mb-2 text-sm font-medium text-muted-foreground">Positions</h2>
        <PositionsTable analytics={analytics} />
      </div>
    </div>
  );
}
