"use client";

import { useEffect } from "react";

import { AlertTriangleIcon } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { logUnexpectedError } from "@/shared/infrastructure/logging";

/** Error boundary for the authenticated product area at large (account, the portfolio list). */
export default function ProductError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    logUnexpectedError("product", error);
  }, [error]);

  return (
    <div className="mx-auto w-full max-w-lg p-6">
      <Alert variant="destructive" role="alert">
        <AlertTriangleIcon />
        <AlertTitle>Something went wrong</AlertTitle>
        <AlertDescription>
          <p>This page could not be loaded. Your data is safe — nothing was changed.</p>
          <Button variant="outline" size="sm" onClick={() => retry()} className="mt-2">
            Try again
          </Button>
        </AlertDescription>
      </Alert>
    </div>
  );
}
