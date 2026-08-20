"use client";

import { useEffect } from "react";

import { AlertTriangleIcon } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { logUnexpectedError } from "@/shared/infrastructure/logging";

/**
 * Error boundary for one portfolio's routes (summary, operations,
 * instruments, prices, allocation, history). Catches uncaught exceptions
 * from those Server Components — an expected `DomainError` from a Server
 * Action never reaches here, since it is mapped to `FormActionState`
 * before it can throw across the boundary.
 */
export default function PortfolioSectionError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    logUnexpectedError("portfolio-section", error);
  }, [error]);

  return (
    <Alert variant="destructive" role="alert">
      <AlertTriangleIcon />
      <AlertTitle>Something went wrong</AlertTitle>
      <AlertDescription>
        <p>This section could not be loaded. Your data is safe — nothing was changed.</p>
        <Button variant="outline" size="sm" onClick={() => retry()} className="mt-2">
          Try again
        </Button>
      </AlertDescription>
    </Alert>
  );
}
