"use server";

import { revalidatePath } from "next/cache";

import { requireVerifiedActor } from "@/modules/identity/application/actor";
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
import { listPortfolioIdsForInstrument } from "@/modules/transactions/application/ledger-commands";
import { isDomainError } from "@/shared/domain/errors";
import type { UserId } from "@/shared/domain/user-id";
import { logUnexpectedError } from "@/shared/infrastructure/logging";

/** Shared result shape for pricing's price-observation Server Actions. */
export type PriceObservationActionState =
  | { status: "idle" }
  | { status: "success"; message: string }
  | { status: "error"; message: string; fieldErrors?: Record<string, string[]> };

const PRICES_PATH = "/prices";

/**
 * Invalidates every route that reads this instrument's price through
 * portfolio analytics (finding: "Price correction invalidation") —
 * summary/return (the portfolio's index page), allocation, and history —
 * for exactly the portfolios that have ever traded it, so a correction is
 * reflected on next client navigation without a hard reload. Precise
 * rather than conservative: it queries the ledger for portfolios that
 * actually hold a BUY/SELL of `instrumentId` instead of revalidating every
 * portfolio the owner has.
 */
async function invalidateAffectedPortfolioAnalytics(ownerId: UserId, instrumentId: string): Promise<void> {
  const portfolioIds = await listPortfolioIdsForInstrument(ownerId, instrumentId);
  for (const portfolioId of portfolioIds) {
    revalidatePath(`/portfolios/${portfolioId}`);
    revalidatePath(`/portfolios/${portfolioId}/allocation`);
    revalidatePath(`/portfolios/${portfolioId}/history`);
  }
}

function toErrorState(error: unknown, fallbackMessage: string): PriceObservationActionState {
  if (isDomainError(error)) {
    const fieldErrors = "fieldErrors" in error ? (error as { fieldErrors: Record<string, string[]> }).fieldErrors : undefined;
    return { status: "error", message: error.message, fieldErrors };
  }
  // Unexpected errors are logged, not surfaced verbatim, to avoid leaking
  // internals (design.md task 9.4: privacy-safe logging and error mapping).
  logUnexpectedError("pricing-action", error);
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

  let ownerId: UserId;
  try {
    ownerId = (await requireVerifiedActor()).userId;
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
  await invalidateAffectedPortfolioAnalytics(ownerId, parsed.data.instrumentId);
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

  let ownerId: UserId;
  let updated;
  try {
    ownerId = (await requireVerifiedActor()).userId;
    updated = await editPriceObservation(priceObservationRepository, ownerId, toPriceObservationId(parsed.data.id), {
      price: parsed.data.price,
      effectiveDate: parsed.data.effectiveDate,
    });
  } catch (error) {
    return toErrorState(error, "Could not update the price observation.");
  }

  revalidatePath(PRICES_PATH);
  await invalidateAffectedPortfolioAnalytics(ownerId, updated.instrumentId);
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

  let ownerId: UserId;
  let instrumentId: string | undefined;
  try {
    ownerId = (await requireVerifiedActor()).userId;
    const id = toPriceObservationId(parsed.data.id);
    // Looked up before deleting so the affected portfolios can still be
    // identified afterward — once the row is gone, its instrument link
    // would be too.
    instrumentId = (await priceObservationRepository.findOwnedById(ownerId, id))?.instrumentId;
    await deletePriceObservation(priceObservationRepository, ownerId, id);
  } catch (error) {
    return toErrorState(error, "Could not delete the price observation.");
  }

  revalidatePath(PRICES_PATH);
  if (instrumentId) {
    await invalidateAffectedPortfolioAnalytics(ownerId, instrumentId);
  }
  return { status: "success", message: "Price deleted." };
}
