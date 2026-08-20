import { redirect } from "next/navigation";

import { getCurrentActor } from "@/modules/identity/application/actor";

/**
 * Shared shell for the unauthenticated identity flows (sign-up, sign-in,
 * forgot-password). An already-signed-in visitor is sent to the
 * authenticated area instead of being shown a redundant sign-in form.
 */
export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const actor = await getCurrentActor();
  if (actor) {
    redirect("/");
  }

  return (
    <div className="flex flex-1 items-center justify-center p-6">
      <div className="w-full max-w-sm">{children}</div>
    </div>
  );
}
