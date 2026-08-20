import { Skeleton } from "@/components/ui/skeleton";

export default function AccountLoading() {
  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-6 p-6" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading your account…</span>
      <Skeleton className="h-6 w-32" />
      <Skeleton className="h-40" />
    </div>
  );
}
