import { NextResponse } from "next/server";

/**
 * Liveness probe: reports only that the Node.js process is up and serving
 * requests. It must not touch PostgreSQL — a database outage should not
 * make an orchestrator kill and restart otherwise-healthy application
 * containers. See `api/health/ready` for readiness.
 */
export async function GET() {
  return NextResponse.json({ status: "ok" });
}
