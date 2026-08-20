"use client";

import { useFormStatus } from "react-dom";

import { Button } from "@/components/ui/button";

/**
 * Submit button that disables itself and announces progress while its
 * parent form's action is pending, preventing accidental duplicate
 * submission (identity spec: "Authentication request is in progress").
 */
export function SubmitButton({
  children,
  pendingLabel,
  variant,
}: {
  children: React.ReactNode;
  pendingLabel: string;
  variant?: React.ComponentProps<typeof Button>["variant"];
}) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} aria-busy={pending} variant={variant}>
      {pending ? pendingLabel : children}
    </Button>
  );
}
