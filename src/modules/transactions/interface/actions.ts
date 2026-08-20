"use server";

import { revalidatePath } from "next/cache";

import { requireVerifiedActor } from "@/modules/identity/application/actor";
import { type FormActionState, toErrorFormActionState } from "@/shared/application/form-action-state";

import { contributeAndInvest } from "../application/contribute-and-invest";
import { createLedgerEntry, deleteLedgerEntry, editLedgerEntry } from "../application/ledger-commands";
import type { RawLedgerEntryInput } from "../domain/ledger-entry";
import {
  contributeAndInvestSchema,
  createLedgerEntrySchema,
  deleteLedgerEntrySchema,
  editLedgerEntrySchema,
} from "./schema";

/** Revalidates every page under one portfolio (summary, operations, allocation, history all derive from the same ledger). */
function revalidatePortfolio(portfolioId: string): void {
  revalidatePath(`/portfolios/${portfolioId}`, "layout");
}

export async function createLedgerEntryAction(
  _prevState: FormActionState,
  formData: FormData,
): Promise<FormActionState> {
  const parsed = createLedgerEntrySchema.safeParse(Object.fromEntries(formData));

  if (!parsed.success) {
    return {
      status: "error",
      message: "Check the highlighted fields.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const input: Omit<RawLedgerEntryInput, "id" | "sequence" | "groupId"> = {
    type: parsed.data.type,
    portfolioId: parsed.data.portfolioId,
    effectiveDate: parsed.data.effectiveDate,
    instrumentId: parsed.data.instrumentId,
    cashAmount: parsed.data.cashAmount,
    quantity: parsed.data.quantity,
    unitPrice: parsed.data.unitPrice,
    fee: parsed.data.fee,
    note: parsed.data.note,
  };

  try {
    const actor = await requireVerifiedActor();
    await createLedgerEntry(actor.userId, input);
  } catch (error) {
    return toErrorFormActionState(error);
  }

  revalidatePortfolio(parsed.data.portfolioId);
  return { status: "success", message: `${parsed.data.type} recorded.` };
}

export async function editLedgerEntryAction(
  _prevState: FormActionState,
  formData: FormData,
): Promise<FormActionState> {
  const parsed = editLedgerEntrySchema.safeParse(Object.fromEntries(formData));

  if (!parsed.success) {
    return {
      status: "error",
      message: "Check the highlighted fields.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  try {
    const actor = await requireVerifiedActor();
    const updated = await editLedgerEntry(actor.userId, parsed.data.id, {
      effectiveDate: parsed.data.effectiveDate,
      instrumentId: parsed.data.instrumentId,
      cashAmount: parsed.data.cashAmount,
      quantity: parsed.data.quantity,
      unitPrice: parsed.data.unitPrice,
      fee: parsed.data.fee,
      note: parsed.data.note,
    });
    revalidatePortfolio(updated.portfolioId);
  } catch (error) {
    return toErrorFormActionState(error);
  }

  return { status: "success", message: "Entry updated." };
}

export async function deleteLedgerEntryAction(
  _prevState: FormActionState,
  formData: FormData,
): Promise<FormActionState> {
  const parsed = deleteLedgerEntrySchema.safeParse(Object.fromEntries(formData));

  if (!parsed.success) {
    return { status: "error", message: "Invalid request." };
  }

  const portfolioId = formData.get("portfolioId");

  try {
    const actor = await requireVerifiedActor();
    await deleteLedgerEntry(actor.userId, parsed.data.id);
  } catch (error) {
    return toErrorFormActionState(error);
  }

  if (typeof portfolioId === "string") revalidatePortfolio(portfolioId);
  return { status: "success", message: "Entry deleted." };
}

export async function contributeAndInvestAction(
  _prevState: FormActionState,
  formData: FormData,
): Promise<FormActionState> {
  const parsed = contributeAndInvestSchema.safeParse(Object.fromEntries(formData));

  if (!parsed.success) {
    return {
      status: "error",
      message: "Check the highlighted fields.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  try {
    const actor = await requireVerifiedActor();
    await contributeAndInvest(actor.userId, parsed.data);
  } catch (error) {
    return toErrorFormActionState(error);
  }

  revalidatePortfolio(parsed.data.portfolioId);
  return { status: "success", message: "Contribution and buy recorded." };
}
