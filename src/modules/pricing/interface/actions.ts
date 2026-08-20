"use server";

import { revalidatePath } from "next/cache";

import { getCurrentUserId } from "@/modules/identity/application/get-current-user-id";
import { deletePriceObservation } from "@/modules/pricing/application/commands/delete-price-observation";
import { editPriceObservation } from "@/modules/pricing/application/commands/edit-price-observation";
import { recordPriceObservation } from "@/modules/pricing/application/commands/record-price-observation";
import { toInstrumentId, toPriceObservationId } from "@/modules/pricing/domain/price-observation";
import { priceObservationRepository } from "@/modules/pricing/infrastructure/price-observation-repository";
import {
  createPriceObservationSchema,
  deletePriceObservationSchema,
  editPriceObservationSchema,
} from "@/modules/pricing/interface/schema";
import { isDomainError } from "@/shared/domain/errors";

/** Shared result shape for pricing's price-observation Server Actions. */
export type PriceObservationActionState =
  | { status: "idle" }
  | { status: "success"; message: string }
  | { status: "error"; message: string; fieldErrors?: Record<string, string[]> };

const PRICES_PATH = "/prices";

function toErrorState(error: unknown, fallbackMessage: string): PriceObservationActionState {
  if (isDomainError(error)) {
    const fieldErrors = "fieldErrors" in error ? (error as { fieldErrors: Record<string, string[]> }).fieldErrors : undefined;
    return { status: "error", message: error.message, fieldErrors };
  }
  // Unexpected errors are logged, not surfaced verbatim, to avoid leaking
  // internals (design.md task 9.4: privacy-safe logging and error mapping).
  console.error(fallbackMessage, error);
  return { status: "error", message: fallbackMessage };
}

export async function createPriceObservationAction(
  _prevState: PriceObservationActionState,
  formData: FormData,
): Promise<PriceObservationActionState> {
  const parsed = createPriceObservationSchema.safeParse({
    instrumentId: formData.get("instrumentId"),
    price: formData.get("price"),
    effectiveDate: formData.get("effectiveDate"),
  });

  if (!parsed.success) {
    return {
      status: "error",
      message: "Check the highlighted fields.",
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  try {
    const ownerId = await getCurrentUserId();
    await recordPriceObservation(priceObservationRepository, {
      ownerId,
      instrumentId: toInstrumentId(parsed.data.instrumentId),
      price: parsed.data.price,
      currency: "EUR",
      effectiveDate: parsed.data.effectiveDate,
    });
  } catch (error) {
    return toErrorState(error, "Could not record the price observation.");
  }

  revalidatePath(PRICES_PATH);
  return { status: "success", message: "Price recorded." };
}

export async function editPriceObservationAction(
  _prevState: PriceObservationActionState,
  formData: FormData,
): Promise<PriceObservationActionState> {
  const parsed = editPriceObservationSchema.safeParse({
    id: formData.get("id"),
    price: formData.get("price"),
    effectiveDate: formData.get("effectiveDate"),
  });

  if (!parsed.success) {
    return {
      status: "error",
      message: "Check the highlighted fields.",
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  try {
    const ownerId = await getCurrentUserId();
    await editPriceObservation(priceObservationRepository, ownerId, toPriceObservationId(parsed.data.id), {
      price: parsed.data.price,
      effectiveDate: parsed.data.effectiveDate,
    });
  } catch (error) {
    return toErrorState(error, "Could not update the price observation.");
  }

  revalidatePath(PRICES_PATH);
  return { status: "success", message: "Price updated." };
}

export async function deletePriceObservationAction(
  _prevState: PriceObservationActionState,
  formData: FormData,
): Promise<PriceObservationActionState> {
  const parsed = deletePriceObservationSchema.safeParse({ id: formData.get("id") });

  if (!parsed.success) {
    return { status: "error", message: "Invalid price observation." };
  }

  try {
    const ownerId = await getCurrentUserId();
    await deletePriceObservation(priceObservationRepository, ownerId, toPriceObservationId(parsed.data.id));
  } catch (error) {
    return toErrorState(error, "Could not delete the price observation.");
  }

  revalidatePath(PRICES_PATH);
  return { status: "success", message: "Price deleted." };
}
