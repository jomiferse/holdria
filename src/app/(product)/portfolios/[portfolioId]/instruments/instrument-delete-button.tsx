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
import { deleteInstrumentAction } from "@/modules/instruments/interface/actions";
import type { Instrument } from "@/modules/instruments/domain/instrument";

/** Delete confirmation for one instrument. A referenced instrument fails with an explanatory message instead of a generic error. */
export function InstrumentDeleteButton({ instrument }: { instrument: Instrument }) {
  const [open, setOpen] = useState(false);
  const [, dispatch, pending] = useFormAction(deleteInstrumentAction, (result) => {
    if (result.status === "success") {
      toast.success(result.message);
      setOpen(false);
    } else if (result.status === "error") {
      toast.error(result.message);
    }
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="destructive" size="sm">
          Delete
        </Button>
      </DialogTrigger>
      <DialogContent>
        <form action={dispatch} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>Delete “{instrument.name}”?</DialogTitle>
            <DialogDescription>
              This cannot be undone. Instruments used by an operation or price cannot be deleted.
            </DialogDescription>
          </DialogHeader>
          <input type="hidden" name="id" value={instrument.id} />
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit" variant="destructive" disabled={pending}>
              {pending ? "Deleting…" : "Delete instrument"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
