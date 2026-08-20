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
import { createInstrumentAction, updateInstrumentAction } from "@/modules/instruments/interface/actions";
import { INSTRUMENT_TYPES, type Instrument, type InstrumentType } from "@/modules/instruments/domain/instrument";

interface InstrumentFormProps {
  instrument?: Instrument;
  trigger: React.ReactNode;
}

/**
 * Create/edit dialog for one instrument. Type-aware: ISIN is required
 * only for FUND, ticker/market are only meaningful for ETF/STOCK, and
 * validation feedback comes straight from the Server Action's field
 * errors so the invalid field is identified per the spec.
 */
export function InstrumentForm({ instrument, trigger }: InstrumentFormProps) {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<InstrumentType>(instrument?.type ?? "FUND");
  const action = instrument ? updateInstrumentAction : createInstrumentAction;
  const [state, dispatch, pending] = useFormAction(action, (result) => {
    if (result.status === "success") {
      toast.success(result.message);
      setOpen(false);
    } else if (result.status === "error" && !result.fieldErrors) {
      toast.error(result.message);
    }
  });

  const fieldErrors = state.status === "error" ? state.fieldErrors : undefined;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) {
          // Reset the type toggle to the instrument's current type each
          // time the dialog opens (an event, not a render-time effect).
          setType(instrument?.type ?? "FUND");
        }
      }}
    >
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <form action={dispatch} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>{instrument ? "Edit instrument" : "Add instrument"}</DialogTitle>
            <DialogDescription>
              Funds, ETFs, and stocks are EUR-denominated and reusable across your portfolios.
            </DialogDescription>
          </DialogHeader>
          {instrument && <input type="hidden" name="id" value={instrument.id} />}

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="instrument-type">Type</Label>
            <SelectNative
              id="instrument-type"
              name="type"
              value={type}
              onChange={(event) => setType(event.target.value as InstrumentType)}
              aria-invalid={Boolean(fieldErrors?.type?.[0])}
            >
              {INSTRUMENT_TYPES.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </SelectNative>
            {fieldErrors?.type?.[0] && <p className="text-sm text-destructive">{fieldErrors.type[0]}</p>}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="instrument-name">Name</Label>
            <Input
              id="instrument-name"
              name="name"
              defaultValue={instrument?.name}
              required
              maxLength={120}
              aria-invalid={Boolean(fieldErrors?.name?.[0])}
            />
            {fieldErrors?.name?.[0] && <p className="text-sm text-destructive">{fieldErrors.name[0]}</p>}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="instrument-isin">ISIN {type === "FUND" && <span aria-hidden>*</span>}</Label>
            <Input
              id="instrument-isin"
              name="isin"
              defaultValue={instrument?.isin ?? ""}
              placeholder="e.g. IE00B4L5Y983"
              required={type === "FUND"}
              aria-invalid={Boolean(fieldErrors?.isin?.[0])}
              aria-describedby="instrument-isin-help"
            />
            <p id="instrument-isin-help" className="text-xs text-muted-foreground">
              {type === "FUND"
                ? "Required for funds. Lowercase letters and spaces are normalized automatically."
                : "Optional for ETFs and stocks."}
            </p>
            {fieldErrors?.isin?.[0] && <p className="text-sm text-destructive">{fieldErrors.isin[0]}</p>}
          </div>

          {type !== "FUND" && (
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="instrument-ticker">Ticker</Label>
                <Input id="instrument-ticker" name="ticker" defaultValue={instrument?.ticker ?? ""} maxLength={20} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="instrument-market">Market</Label>
                <Input id="instrument-market" name="market" defaultValue={instrument?.market ?? ""} maxLength={20} />
              </div>
            </div>
          )}

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : instrument ? "Save changes" : "Add instrument"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
