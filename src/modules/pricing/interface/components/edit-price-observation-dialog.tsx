"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PriceObservationForm } from "@/modules/pricing/interface/components/price-observation-form";

interface EditPriceObservationDialogProps {
  readonly instrumentId: string;
  readonly observation: { readonly id: string; readonly price: string; readonly effectiveDate: string };
}

/** Opens a dialog to correct an existing manual price's value and/or effective date. */
export function EditPriceObservationDialog({ instrumentId, observation }: EditPriceObservationDialogProps) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button variant="ghost" size="sm" onClick={() => setOpen(true)}>
        Edit
      </Button>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Correct price for {observation.effectiveDate}</DialogTitle>
        </DialogHeader>
        <PriceObservationForm instrumentId={instrumentId} observation={observation} onSuccess={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}
