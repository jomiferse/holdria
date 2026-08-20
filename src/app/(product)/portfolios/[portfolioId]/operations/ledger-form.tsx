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
import { createLedgerEntryAction, editLedgerEntryAction } from "@/modules/transactions/interface/actions";
import type { LedgerEntryType } from "@/modules/transactions/domain/ledger-entry";
import type { LedgerEntryView, LedgerInstrumentOption } from "@/modules/transactions/interface/queries";

const ENTRY_TYPES: readonly LedgerEntryType[] = ["CONTRIBUTION", "WITHDRAWAL", "BUY", "SELL"];

interface LedgerFormProps {
  readonly portfolioId: string;
  readonly instruments: readonly LedgerInstrumentOption[];
  /** Plain view, not the domain `LedgerEntry` — Client Components cannot receive its `Money`/`Quantity`/`DateOnly` instances as props. */
  readonly entry?: LedgerEntryView;
  readonly trigger: React.ReactNode;
}

function isTradeType(type: LedgerEntryType): boolean {
  return type === "BUY" || type === "SELL";
}

/**
 * Create/edit dialog for one ledger entry. Type-aware: CONTRIBUTION and
 * WITHDRAWAL show only a cash amount; BUY and SELL show instrument,
 * quantity, unit price, and an optional fee. Domain and application
 * errors — including negative-cash, negative-units, and backdated
 * conflicts (ledger spec: "Ledger invariants") — surface as the Server
 * Action's error message.
 */
export function LedgerForm({ portfolioId, instruments, entry, trigger }: LedgerFormProps) {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<LedgerEntryType>(entry?.type ?? "CONTRIBUTION");
  const action = entry ? editLedgerEntryAction : createLedgerEntryAction;
  const [state, dispatch, pending] = useFormAction(action, (result) => {
    if (result.status === "success") {
      toast.success(result.message);
      setOpen(false);
    } else if (result.status === "error" && !result.fieldErrors) {
      toast.error(result.message);
    }
  });

  const fieldErrors = state.status === "error" ? state.fieldErrors : undefined;
  const generalError = state.status === "error" && !state.fieldErrors ? state.message : undefined;

  const cashAmount = entry?.cashAmount ?? "";
  const instrumentId = entry?.instrumentId ?? "";
  const quantity = entry?.quantity ?? "";
  const unitPrice = entry?.unitPrice ?? "";
  const fee = entry?.fee ?? "";

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) setType(entry?.type ?? "CONTRIBUTION");
      }}
    >
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <form action={dispatch} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>{entry ? "Edit operation" : "Add operation"}</DialogTitle>
            <DialogDescription>
              Contributions and withdrawals move cash; buys and sells trade an instrument.
            </DialogDescription>
          </DialogHeader>

          <input type="hidden" name="portfolioId" value={portfolioId} />
          {entry ? <input type="hidden" name="id" value={entry.id ?? ""} /> : null}

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ledger-type">Type</Label>
            <SelectNative
              id="ledger-type"
              name="type"
              value={type}
              disabled={Boolean(entry)}
              onChange={(event) => setType(event.target.value as LedgerEntryType)}
              aria-invalid={Boolean(fieldErrors?.type?.[0])}
            >
              {ENTRY_TYPES.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </SelectNative>
            {entry && <p className="text-xs text-muted-foreground">The entry type cannot change after creation.</p>}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ledger-effective-date">Effective date</Label>
            <Input
              id="ledger-effective-date"
              name="effectiveDate"
              type="date"
              defaultValue={entry?.effectiveDate.toString()}
              required
              aria-invalid={Boolean(fieldErrors?.effectiveDate?.[0])}
            />
            {fieldErrors?.effectiveDate?.[0] && <p className="text-sm text-destructive">{fieldErrors.effectiveDate[0]}</p>}
          </div>

          {isTradeType(type) ? (
            <>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="ledger-instrument">Instrument</Label>
                <SelectNative
                  id="ledger-instrument"
                  name="instrumentId"
                  defaultValue={instrumentId}
                  required
                  aria-invalid={Boolean(fieldErrors?.instrumentId?.[0])}
                >
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
                  <Label htmlFor="ledger-quantity">Quantity</Label>
                  <Input
                    id="ledger-quantity"
                    name="quantity"
                    inputMode="decimal"
                    defaultValue={quantity}
                    required
                    aria-invalid={Boolean(fieldErrors?.quantity?.[0])}
                  />
                  {fieldErrors?.quantity?.[0] && <p className="text-sm text-destructive">{fieldErrors.quantity[0]}</p>}
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="ledger-unit-price">Unit price (EUR)</Label>
                  <Input
                    id="ledger-unit-price"
                    name="unitPrice"
                    inputMode="decimal"
                    defaultValue={unitPrice}
                    required
                    aria-invalid={Boolean(fieldErrors?.unitPrice?.[0])}
                  />
                  {fieldErrors?.unitPrice?.[0] && <p className="text-sm text-destructive">{fieldErrors.unitPrice[0]}</p>}
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="ledger-fee">Fee (EUR, optional)</Label>
                <Input id="ledger-fee" name="fee" inputMode="decimal" defaultValue={fee} placeholder="0" />
              </div>
            </>
          ) : (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="ledger-cash-amount">Amount (EUR)</Label>
              <Input
                id="ledger-cash-amount"
                name="cashAmount"
                inputMode="decimal"
                defaultValue={cashAmount}
                required
                aria-invalid={Boolean(fieldErrors?.cashAmount?.[0])}
              />
              {fieldErrors?.cashAmount?.[0] && <p className="text-sm text-destructive">{fieldErrors.cashAmount[0]}</p>}
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ledger-note">Note (optional)</Label>
            <Input id="ledger-note" name="note" defaultValue={entry?.note ?? ""} maxLength={280} />
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
              {pending ? "Saving…" : entry ? "Save changes" : "Add operation"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
