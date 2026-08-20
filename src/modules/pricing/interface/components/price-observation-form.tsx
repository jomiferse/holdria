"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  createPriceObservationAction,
  editPriceObservationAction,
  type PriceObservationActionState,
} from "@/modules/pricing/interface/actions";

const idleState: PriceObservationActionState = { status: "idle" };

interface PriceObservationFormProps {
  readonly instrumentId: string;
  /** Present when editing an existing observation; omitted when recording a new one. */
  readonly observation?: {
    readonly id: string;
    readonly price: string;
    readonly effectiveDate: string;
  };
  readonly onSuccess?: () => void;
}

/**
 * Records a new manual price or corrects an existing one.
 *
 * Never presents the recorded value as real-time: the effective date is
 * always a required, visible field, and success feedback refers to
 * "recording" or "correcting" a dated price, not a live quote.
 */
export function PriceObservationForm({ instrumentId, observation, onSuccess }: PriceObservationFormProps) {
  const isEditing = observation !== undefined;
  const submit = isEditing ? editPriceObservationAction : createPriceObservationAction;

  const [state, formAction, isPending] = useActionState(async (prevState: PriceObservationActionState, formData: FormData) => {
    const result = await submit(prevState, formData);
    if (result.status === "success") {
      onSuccess?.();
    }
    return result;
  }, idleState);

  const fieldError = (field: string) => state.status === "error" ? state.fieldErrors?.[field]?.[0] : undefined;

  return (
    <form action={formAction} className="grid gap-3">
      {isEditing ? <input type="hidden" name="id" value={observation.id} /> : (
        <input type="hidden" name="instrumentId" value={instrumentId} />
      )}

      <div className="grid gap-1.5">
        <Label htmlFor="price">Price (EUR)</Label>
        <Input
          id="price"
          name="price"
          inputMode="decimal"
          defaultValue={observation?.price}
          aria-invalid={Boolean(fieldError("price"))}
          aria-describedby={fieldError("price") ? "price-error" : undefined}
          required
        />
        {fieldError("price") && (
          <p id="price-error" className="text-sm text-destructive">
            {fieldError("price")}
          </p>
        )}
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="effectiveDate">Effective date</Label>
        <Input
          id="effectiveDate"
          name="effectiveDate"
          type="date"
          defaultValue={observation?.effectiveDate}
          aria-invalid={Boolean(fieldError("effectiveDate"))}
          aria-describedby={fieldError("effectiveDate") ? "effectiveDate-error" : undefined}
          required
        />
        {fieldError("effectiveDate") && (
          <p id="effectiveDate-error" className="text-sm text-destructive">
            {fieldError("effectiveDate")}
          </p>
        )}
        <p className="text-xs text-muted-foreground">The date this price was true, not today&apos;s date.</p>
      </div>

      {state.status === "error" && !state.fieldErrors && (
        <p role="alert" className="text-sm text-destructive">
          {state.message}
        </p>
      )}

      <Button type="submit" disabled={isPending}>
        {isEditing ? "Save correction" : "Record price"}
      </Button>
    </form>
  );
}
