"use server";

import { revalidatePath } from "next/cache";

import { requireVerifiedActor } from "@/modules/identity/application/actor";
import { type FormActionState, toErrorFormActionState } from "@/shared/application/form-action-state";
import { createInstrument, deleteInstrument, updateInstrument } from "../application/commands";
import { drizzleInstrumentRepository } from "../infrastructure/drizzle-instrument-repository";
import { toInstrumentId } from "../domain/instrument";
import { createInstrumentSchema, deleteInstrumentSchema, updateInstrumentSchema } from "./schemas";

const deps = { repository: drizzleInstrumentRepository };

export async function createInstrumentAction(
  _prevState: FormActionState,
  formData: FormData,
): Promise<FormActionState> {
  const parsed = createInstrumentSchema.safeParse(Object.fromEntries(formData));

  if (!parsed.success) {
    return {
      status: "error",
      message: "Check the highlighted fields.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  try {
    const actor = await requireVerifiedActor();
    await createInstrument(deps, actor, parsed.data);
  } catch (error) {
    return toErrorFormActionState(error);
  }

  // Instruments are user-owned, not portfolio-owned, but every portfolio's
  // instruments tab reads the same list — invalidate every portfolio
  // route rather than one path.
  revalidatePath("/portfolios", "layout");
  return { status: "success", message: `“${parsed.data.name}” created.` };
}

export async function updateInstrumentAction(
  _prevState: FormActionState,
  formData: FormData,
): Promise<FormActionState> {
  const parsed = updateInstrumentSchema.safeParse(Object.fromEntries(formData));

  if (!parsed.success) {
    return {
      status: "error",
      message: "Check the highlighted fields.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  try {
    const actor = await requireVerifiedActor();
    await updateInstrument(deps, actor, { ...parsed.data, id: toInstrumentId(parsed.data.id) });
  } catch (error) {
    return toErrorFormActionState(error);
  }

  revalidatePath("/portfolios", "layout");
  return { status: "success", message: "Instrument updated." };
}

export async function deleteInstrumentAction(
  _prevState: FormActionState,
  formData: FormData,
): Promise<FormActionState> {
  const parsed = deleteInstrumentSchema.safeParse(Object.fromEntries(formData));

  if (!parsed.success) {
    return { status: "error", message: "Invalid request." };
  }

  try {
    const actor = await requireVerifiedActor();
    await deleteInstrument(deps, actor, toInstrumentId(parsed.data.id));
  } catch (error) {
    return toErrorFormActionState(error);
  }

  revalidatePath("/portfolios", "layout");
  return { status: "success", message: "Instrument deleted." };
}
