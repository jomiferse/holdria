import { closeDatabaseConnection } from "@/db/client";

/**
 * Node.js-only shutdown logic, kept out of `instrumentation.ts` itself so
 * Next.js's Edge Runtime bundle never has to statically analyze
 * `process.exit`/`process.once` (Turbopack otherwise warns even when the
 * call is behind a `NEXT_RUNTIME === "nodejs"` guard).
 */
export function registerGracefulShutdown(): void {
  const shutdown = async (signal: string) => {
    console.log(`Received ${signal}, closing database connection pool...`);
    await closeDatabaseConnection();
    process.exit(0);
  };

  process.once("SIGTERM", () => void shutdown("SIGTERM"));
  process.once("SIGINT", () => void shutdown("SIGINT"));
}
