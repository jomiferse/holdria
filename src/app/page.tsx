import { Button } from "@/components/ui/button";
import { getCurrentActor } from "@/modules/identity/application/actor";

/**
 * Temporary placeholder landing page. The real public marketing and
 * onboarding experience is built in module 4 (Portfolio Management and
 * Product Shell) of the MVP change; this only confirms the application
 * foundation (routing, Tailwind, shadcn/ui) renders end to end and links
 * to the identity flows built in module 3.
 */
export default async function Home() {
  const actor = await getCurrentActor();

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
      <h1>Holdria</h1>
      <p className="text-muted-foreground max-w-md text-balance">
        Track your investment portfolios without spreadsheets or broker
        integrations. The product experience is under construction.
      </p>
      <div className="flex gap-3">
        {actor ? (
          <Button asChild>
            <a href="/account">Account</a>
          </Button>
        ) : (
          <>
            <Button asChild>
              <a href="/sign-up">Create account</a>
            </Button>
            <Button asChild variant="outline">
              <a href="/sign-in">Sign in</a>
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
