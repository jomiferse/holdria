# syntax=docker/dockerfile:1

# Multi-stage build producing a small, portable runtime image. Every
# variable the running container needs is provided at container start via
# environment variables (see .env.example / docker-compose.yml); nothing is
# baked in at build time and the container stores no durable state on its
# own filesystem — PostgreSQL is a separate, persistently backed service.

FROM node:22-alpine AS base
WORKDIR /app
RUN corepack enable

FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Build-time-only placeholders satisfy env validation while `next build`
# collects route metadata; no real secret or database is required to
# produce the standalone build output.
ENV DATABASE_URL="postgresql://build:build@localhost:5432/build" \
    BETTER_AUTH_SECRET="build-time-placeholder-secret-not-used-at-runtime" \
    BETTER_AUTH_URL="http://localhost:3000" \
    SMTP_HOST="localhost"
RUN pnpm build

FROM base AS runner
ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# .next/standalone/server.js is Next.js's self-contained Node.js entry
# point produced by `output: "standalone"` (next.config.ts).
CMD ["node", "server.js"]
