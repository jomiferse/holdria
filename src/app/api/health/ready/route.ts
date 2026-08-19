import { NextResponse } from "next/server";

import { checkDatabaseConnection } from "@/db/client";

/**
 * Readiness probe: reports whether this replica can currently serve
 * requests that need PostgreSQL. An orchestrator should stop routing
 * traffic to a not-ready replica without necessarily restarting it — the
 * database may simply be temporarily unavailable.
 */
export async function GET() {
  const databaseReachable = await checkDatabaseConnection();

  if (!databaseReachable) {
    return NextResponse.json(
      { status: "unavailable", database: "unreachable" },
      { status: 503 },
    );
  }

  return NextResponse.json({ status: "ready", database: "reachable" });
}
