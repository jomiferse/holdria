"use client";

import { useEffect } from "react";

import { logUnexpectedError } from "@/shared/infrastructure/logging";

/**
 * Root error boundary (catches what escapes every nested `error.tsx`,
 * including failures in the root layout itself). Must render its own
 * `<html>`/`<body>` — it replaces the root layout while active.
 */
export default function GlobalError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    logUnexpectedError("root", error);
  }, [error]);

  return (
    <html lang="en">
      <body className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
        <h1 className="text-lg font-semibold">Something went wrong</h1>
        <p className="text-sm text-muted-foreground">
          Holdria could not load. Your data is safe — nothing was changed.
        </p>
        <button
          type="button"
          onClick={() => retry()}
          className="rounded-lg border px-4 py-2 text-sm font-medium hover:bg-muted"
        >
          Try again
        </button>
      </body>
    </html>
  );
}
