import { Button } from "@/components/ui/button";

/**
 * Temporary placeholder landing page. The real public marketing and
 * onboarding experience is built in module 4 (Portfolio Management and
 * Product Shell) of the MVP change; this only confirms the application
 * foundation (routing, Tailwind, shadcn/ui) renders end to end.
 */
export default function Home() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
      <h1>Holdria</h1>
      <p className="text-muted-foreground max-w-md text-balance">
        Track your investment portfolios without spreadsheets or broker
        integrations. The product experience is under construction.
      </p>
      <Button asChild>
        <a href="/api/health">Check service health</a>
      </Button>
    </div>
  );
}
