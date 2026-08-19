// Aggregates every module's Drizzle schema into one object so Drizzle Kit
// can see the full database shape and generate one versioned SQL migration
// per change, even though the source tables live next to the module that
// owns them (see each module's `infrastructure/schema.ts`). There is one
// database; migrations stay global.
//
// Better Auth's own schema is generated separately (`pnpm db:auth:generate`)
// but re-exported here so it participates in the same aggregated migration.
export * from "./auth-schema";
export * from "@/modules/portfolio/infrastructure/schema";
export * from "@/modules/instruments/infrastructure/schema";
export * from "@/modules/transactions/infrastructure/schema";
export * from "@/modules/pricing/infrastructure/schema";
