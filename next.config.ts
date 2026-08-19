import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Produces a self-contained `.next/standalone` server with only the
  // dependencies it actually needs, so the Docker image does not have to
  // ship the full node_modules tree. Required for the portable,
  // Vercel-independent container deployment (design.md decision 11).
  output: "standalone",
  // Next's file tracing can miss @swc/helpers under pnpm's node_modules
  // layout (a known standalone+pnpm gap); include it explicitly so the
  // Docker image doesn't need a full, untraced node_modules fallback.
  outputFileTracingIncludes: {
    "*": ["./node_modules/@swc/helpers/**"],
  },
};

export default nextConfig;
