"use client";

import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useFormAction } from "@/components/hooks/use-form-action";
import { deleteLedgerEntryAction } from "@/modules/transactions/interface/actions";

/**
 * Delete confirmation for one ledger entry. Deleting an earlier entry that
 * a later balance depends on fails with an explanatory message rather
 * than a generic error (ledger spec: "User deletes a required earlier
 * entry").
 */
export function LedgerDeleteButton({ id, portfolioId, label }: { readonly id: string; readonly portfolioId: string; readonly label: string }) {
  const [open, setOpen] = useState(false);
  const [state, dispatch, pending] = useFormAction(deleteLedgerEntryAction, (result) => {
    if (result.status === "success") {
      toast.success(result.message);
      setOpen(false);
    }
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" aria-label={`Delete ${label}`}>
          Delete
        </Button>
      </DialogTrigger>
      <DialogContent>
        <form action={dispatch} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>Delete {label}?</DialogTitle>
            <DialogDescription>
              This cannot be undone. Deleting an entry that a later balance depends on is rejected instead of leaving
              the ledger inconsistent.
            </DialogDescription>
          </DialogHeader>
          <input type="hidden" name="id" value={id} />
          <input type="hidden" name="portfolioId" value={portfolioId} />
          {state.status === "error" && (
            <p role="alert" className="text-sm text-destructive">
              {state.message}
            </p>
          )}
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit" variant="destructive" disabled={pending}>
              {pending ? "Deleting…" : "Delete"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
