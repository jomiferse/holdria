import { Skeleton } from "@/components/ui/skeleton";

export default function PricesLoading() {
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 p-6" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading manual prices…</span>
      <Skeleton className="h-7 w-40" />
      <div className="grid gap-4">
        <Skeleton className="h-32" />
        <Skeleton className="h-32" />
      </div>
    </div>
  );
}
