import Link from "next/link";

import { getActor } from "@/modules/identity/application/actor";
import { listPortfolios } from "@/modules/portfolio/application/queries";
import { drizzlePortfolioRepository } from "@/modules/portfolio/infrastructure/drizzle-portfolio-repository";
import { PortfolioSwitcher } from "./portfolio-switcher";

/**
 * Shell shared by every authenticated portfolio route: brand, and the
 * portfolio switcher used to move between a user's own portfolios
 * (design.md decision 2 — this is composition, not business logic).
 */
export default async function PortfoliosLayout({ children }: { children: React.ReactNode }) {
  const actor = await getActor();
  const portfolios = await listPortfolios({ repository: drizzlePortfolioRepository }, actor);

  return (
    <div className="flex min-h-full flex-col">
      <header className="flex flex-wrap items-center gap-3 border-b px-4 py-3 sm:px-6">
        <Link href="/portfolios" className="font-heading text-base font-semibold">
          Holdria
        </Link>
        {portfolios.length > 0 && <PortfolioSwitcher portfolios={portfolios} />}
      </header>
      <main className="flex flex-1 flex-col">{children}</main>
    </div>
  );
}
