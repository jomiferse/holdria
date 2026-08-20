import { getActor } from "@/modules/identity/application/actor";
import { getPortfolio } from "@/modules/portfolio/application/queries";
import { drizzlePortfolioRepository } from "@/modules/portfolio/infrastructure/drizzle-portfolio-repository";
import { toPortfolioId } from "@/modules/portfolio/domain/portfolio";
import { ComingSoon } from "./coming-soon";

export default async function PortfolioSummaryPage({
  params,
}: {
  params: Promise<{ portfolioId: string }>;
}) {
  const { portfolioId } = await params;
  const actor = await getActor();
  const portfolio = await getPortfolio(
    { repository: drizzlePortfolioRepository },
    actor,
    toPortfolioId(portfolioId),
  );

  return (
    <div className="flex flex-col gap-4">
      <dl className="grid max-w-sm grid-cols-2 gap-x-4 gap-y-2 text-sm">
        <dt className="text-muted-foreground">Base currency</dt>
        <dd>{portfolio.currency}</dd>
        <dt className="text-muted-foreground">Created</dt>
        <dd>{portfolio.createdAt.toLocaleDateString()}</dd>
      </dl>
      <ComingSoon title="Valuation and result" />
    </div>
  );
}
