import Link from "next/link";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireVerifiedActor } from "@/modules/identity/application/actor";
import { listPortfolios } from "@/modules/portfolio/application/queries";
import { drizzlePortfolioRepository } from "@/modules/portfolio/infrastructure/drizzle-portfolio-repository";
import { PortfolioCreateForm } from "./portfolio-create-form";

export default async function PortfoliosPage() {
  const actor = await requireVerifiedActor();
  const portfolios = await listPortfolios({ repository: drizzlePortfolioRepository }, actor);

  if (portfolios.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-6 p-8 text-center">
        <div className="flex flex-col gap-2">
          <h1 className="font-heading text-xl font-semibold">Welcome to Holdria</h1>
          <p className="max-w-md text-balance text-sm text-muted-foreground">
            Create your first portfolio to start tracking funds, ETFs, and stocks — all in EUR,
            without spreadsheets or broker integrations.
          </p>
        </div>
        <Card className="w-full max-w-sm text-left">
          <CardHeader>
            <CardTitle>Create your first portfolio</CardTitle>
          </CardHeader>
          <CardContent>
            <PortfolioCreateForm />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="font-heading text-xl font-semibold">Your portfolios</h1>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {portfolios.map((portfolio) => (
          <Link key={portfolio.id} href={`/portfolios/${portfolio.id}`}>
            <Card className="h-full transition-colors hover:bg-muted/50">
              <CardHeader>
                {/* `CardTitle` is a styled `div`, not a semantic heading (see
                    `components/ui/card.tsx`) — wrap it in an actual `h2` so
                    a list of portfolios is navigable by heading, matching
                    the "meaningful labels" requirement in the portfolio
                    spec's accessibility scenarios. */}
                <CardTitle>
                  <h2 className="contents">{portfolio.name}</h2>
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                {portfolio.currency}-denominated portfolio
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
      <Card className="max-w-sm">
        <CardHeader>
          <CardTitle>Add another portfolio</CardTitle>
        </CardHeader>
        <CardContent>
          <PortfolioCreateForm />
        </CardContent>
      </Card>
    </div>
  );
}
