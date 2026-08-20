"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PriceObservationForm } from "@/modules/pricing/interface/components/price-observation-form";

/** Opens a dialog to record a new manual price for one instrument. */
export function AddPriceObservationDialog({ instrumentId, instrumentName }: { readonly instrumentId: string; readonly instrumentName: string }) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button size="sm" onClick={() => setOpen(true)}>
        Add price
      </Button>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Record a price for {instrumentName}</DialogTitle>
        </DialogHeader>
        <PriceObservationForm instrumentId={instrumentId} onSuccess={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}
