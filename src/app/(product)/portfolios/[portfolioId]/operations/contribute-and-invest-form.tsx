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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SelectNative } from "@/components/ui/select-native";
import { useFormAction } from "@/components/hooks/use-form-action";
import { contributeAndInvestAction } from "@/modules/transactions/interface/actions";
import type { LedgerInstrumentOption } from "@/modules/transactions/interface/queries";

/**
 * Atomic "contribute and invest" workflow (ledger spec: "Atomic contribute
 * and invest workflow"): records a CONTRIBUTION and a BUY as one linked
 * operation. Either both entries are committed or neither is — the Server
 * Action surfaces a single combined failure rather than a partially
 * applied pair.
 */
export function ContributeAndInvestForm({
  portfolioId,
  instruments,
}: {
  readonly portfolioId: string;
  readonly instruments: readonly LedgerInstrumentOption[];
}) {
  const [open, setOpen] = useState(false);
  const [state, dispatch, pending] = useFormAction(contributeAndInvestAction, (result) => {
    if (result.status === "success") {
      toast.success(result.message);
      setOpen(false);
    } else if (result.status === "error" && !result.fieldErrors) {
      toast.error(result.message);
    }
  });

  const fieldErrors = state.status === "error" ? state.fieldErrors : undefined;
  const generalError = state.status === "error" && !state.fieldErrors ? state.message : undefined;
  const hasInstruments = instruments.length > 0;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" disabled={!hasInstruments} title={hasInstruments ? undefined : "Add an instrument first"}>
          Contribute &amp; invest
        </Button>
      </DialogTrigger>
      <DialogContent>
        <form action={dispatch} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>Contribute and invest</DialogTitle>
            <DialogDescription>Adds cash and buys an instrument with it in one linked operation.</DialogDescription>
          </DialogHeader>

          <input type="hidden" name="portfolioId" value={portfolioId} />

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="cai-effective-date">Effective date</Label>
            <Input id="cai-effective-date" name="effectiveDate" type="date" required aria-invalid={Boolean(fieldErrors?.effectiveDate?.[0])} />
            {fieldErrors?.effectiveDate?.[0] && <p className="text-sm text-destructive">{fieldErrors.effectiveDate[0]}</p>}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="cai-cash-amount">Contribution amount (EUR)</Label>
            <Input id="cai-cash-amount" name="cashAmount" inputMode="decimal" required aria-invalid={Boolean(fieldErrors?.cashAmount?.[0])} />
            {fieldErrors?.cashAmount?.[0] && <p className="text-sm text-destructive">{fieldErrors.cashAmount[0]}</p>}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="cai-instrument">Instrument</Label>
            <SelectNative id="cai-instrument" name="instrumentId" required aria-invalid={Boolean(fieldErrors?.instrumentId?.[0])}>
              <option value="" disabled>
                Select an instrument
              </option>
              {instruments.map((instrument) => (
                <option key={instrument.id} value={instrument.id}>
                  {instrument.name} ({instrument.type})
                </option>
              ))}
            </SelectNative>
            {fieldErrors?.instrumentId?.[0] && <p className="text-sm text-destructive">{fieldErrors.instrumentId[0]}</p>}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="cai-quantity">Quantity</Label>
              <Input id="cai-quantity" name="quantity" inputMode="decimal" required aria-invalid={Boolean(fieldErrors?.quantity?.[0])} />
              {fieldErrors?.quantity?.[0] && <p className="text-sm text-destructive">{fieldErrors.quantity[0]}</p>}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="cai-unit-price">Unit price (EUR)</Label>
              <Input id="cai-unit-price" name="unitPrice" inputMode="decimal" required aria-invalid={Boolean(fieldErrors?.unitPrice?.[0])} />
              {fieldErrors?.unitPrice?.[0] && <p className="text-sm text-destructive">{fieldErrors.unitPrice[0]}</p>}
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="cai-fee">Fee (EUR, optional)</Label>
            <Input id="cai-fee" name="fee" inputMode="decimal" placeholder="0" />
          </div>

          {generalError && (
            <p role="alert" className="text-sm text-destructive">
              {generalError}
            </p>
          )}

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : "Contribute & invest"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
