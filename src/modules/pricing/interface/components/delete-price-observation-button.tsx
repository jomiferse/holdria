"use client";

import { useActionState, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { deletePriceObservationAction, type PriceObservationActionState } from "@/modules/pricing/interface/actions";

const idleState: PriceObservationActionState = { status: "idle" };

/** Deletes one manual price observation, behind an explicit confirmation dialog (design.md: accessible confirmation for destructive actions). */
export function DeletePriceObservationButton({ id, effectiveDate }: { readonly id: string; readonly effectiveDate: string }) {
  const [open, setOpen] = useState(false);

  const [state, formAction, isPending] = useActionState(async (prevState: PriceObservationActionState, formData: FormData) => {
    const result = await deletePriceObservationAction(prevState, formData);
    if (result.status === "success") {
      setOpen(false);
    }
    return result;
  }, idleState);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button variant="ghost" size="sm" onClick={() => setOpen(true)}>
        Delete
      </Button>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete price for {effectiveDate}?</DialogTitle>
          <DialogDescription>
            This removes the manual price observation. Valuations that relied on it will fall back to the next
            eligible earlier price, or show as unpriced if none exists.
          </DialogDescription>
        </DialogHeader>
        {state.status === "error" && (
          <p role="alert" className="text-sm text-destructive">
            {state.message}
          </p>
        )}
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Cancel</Button>
          </DialogClose>
          <form action={formAction}>
            <input type="hidden" name="id" value={id} />
            <Button type="submit" variant="destructive" disabled={isPending}>
              Delete
            </Button>
          </form>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
