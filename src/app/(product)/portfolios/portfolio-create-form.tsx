"use client";

import { useRef } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useFormAction } from "@/components/hooks/use-form-action";
import { createPortfolioAction } from "@/modules/portfolio/interface/actions";

/**
 * Portfolio creation form. Reused for both the first-run onboarding
 * empty state and the ongoing "add another portfolio" action, so both
 * paths share one validation and error-mapping path.
 */
export function PortfolioCreateForm({ className }: { className?: string }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, dispatch, pending] = useFormAction(createPortfolioAction, (result) => {
    if (result.status === "success") {
      toast.success(result.message);
      formRef.current?.reset();
    } else if (result.status === "error" && !result.fieldErrors) {
      toast.error(result.message);
    }
  });

  const nameError = state.status === "error" ? state.fieldErrors?.name?.[0] : undefined;

  return (
    <form ref={formRef} action={dispatch} className={className ?? "flex flex-col gap-3"}>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="portfolio-name">Portfolio name</Label>
        <Input
          id="portfolio-name"
          name="name"
          placeholder="e.g. Retirement"
          required
          maxLength={80}
          aria-invalid={Boolean(nameError)}
          aria-describedby={nameError ? "portfolio-name-error" : undefined}
        />
        {nameError && (
          <p id="portfolio-name-error" className="text-sm text-destructive">
            {nameError}
          </p>
        )}
      </div>
      <Button type="submit" disabled={pending} className="self-start">
        {pending ? "Creating…" : "Create portfolio"}
      </Button>
    </form>
  );
}
