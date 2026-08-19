/**
 * Next.js instrumentation hook: runs once when the server process starts,
 * outside the request/response cycle. Used here to close the PostgreSQL
 * connection pool gracefully on shutdown, so a container orchestrator's
 * SIGTERM does not leave connections dangling on the database side.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") {
    return;
  }

  const { registerGracefulShutdown } = await import("@/lib/graceful-shutdown");
  registerGracefulShutdown();
}
