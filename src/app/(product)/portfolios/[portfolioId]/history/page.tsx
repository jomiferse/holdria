import { requireVerifiedActor } from "@/modules/identity/application/actor";
import { HistoryChart, type HistoryPointView } from "@/modules/analytics/interface/components/history-chart";
import { getPortfolioHistoryView } from "@/modules/analytics/interface/queries";
import { formatEur } from "@/shared/domain/money";

export default async function PortfolioHistoryPage({
  params,
}: {
  params: Promise<{ portfolioId: string }>;
}) {
  const { portfolioId } = await params;
  const actor = await requireVerifiedActor();
  const snapshots = await getPortfolioHistoryView(actor.userId, portfolioId);

  // Mapped to a plain view here, in the Server Component: `PortfolioValuation`
  // carries `Money`/`Decimal` class instances that cannot cross into the
  // client-rendered `HistoryChart` as props.
  const points: HistoryPointView[] = snapshots.map((snapshot) => ({
    date: snapshot.date,
    status: snapshot.valuation.status,
    value:
      snapshot.valuation.status === "complete" ? Number(snapshot.valuation.totalValue!.amount.toFixed(2)) : null,
    formattedValue: snapshot.valuation.status === "complete" ? formatEur(snapshot.valuation.totalValue!) : null,
  }));

  return <HistoryChart points={points} />;
}
