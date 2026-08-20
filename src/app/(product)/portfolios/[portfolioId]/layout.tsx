import { notFound } from "next/navigation";

import { getActor } from "@/modules/identity/application/actor";
import { getPortfolio } from "@/modules/portfolio/application/queries";
import { drizzlePortfolioRepository } from "@/modules/portfolio/infrastructure/drizzle-portfolio-repository";
import { toPortfolioId } from "@/modules/portfolio/domain/portfolio";
import { NotFoundError } from "@/shared/domain/errors";
import { PortfolioTabs } from "./portfolio-tabs";
import { PortfolioActions } from "./portfolio-actions";

export default async function PortfolioLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ portfolioId: string }>;
}) {
  const { portfolioId } = await params;
  const actor = await getActor();

  let portfolio;
  try {
    portfolio = await getPortfolio(
      { repository: drizzlePortfolioRepository },
      actor,
      toPortfolioId(portfolioId),
    );
  } catch (error) {
    // Ownership is enforced at the query layer: an id that exists but is
    // owned by another user resolves the same NotFoundError as one that
    // does not exist at all, so a cross-tenant guess reveals nothing.
    if (error instanceof NotFoundError) {
      notFound();
    }
    throw error;
  }

  return (
    <div className="flex flex-col gap-4 p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-heading text-xl font-semibold">{portfolio.name}</h1>
        <PortfolioActions portfolio={portfolio} />
      </div>
      <PortfolioTabs portfolioId={portfolioId} />
      <div className="flex flex-1 flex-col">{children}</div>
    </div>
  );
}
