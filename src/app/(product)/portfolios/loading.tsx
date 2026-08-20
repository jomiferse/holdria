import { Skeleton } from "@/components/ui/skeleton";

export default function PortfoliosLoading() {
  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading your portfolios…</span>
      <Skeleton className="h-7 w-40" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Skeleton className="h-28" />
        <Skeleton className="h-28" />
        <Skeleton className="h-28" />
      </div>
    </div>
  );
}
