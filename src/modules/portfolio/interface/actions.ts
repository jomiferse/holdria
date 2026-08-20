"use server";

import { revalidatePath } from "next/cache";

import { getActor } from "@/modules/identity/application/actor";
import { type FormActionState, toErrorFormActionState } from "@/shared/application/form-action-state";
import { createPortfolio, deletePortfolio, renamePortfolio } from "../application/commands";
import { drizzlePortfolioRepository } from "../infrastructure/drizzle-portfolio-repository";
import { toPortfolioId } from "../domain/portfolio";
import { createPortfolioSchema, deletePortfolioSchema, renamePortfolioSchema } from "./schemas";

const deps = { repository: drizzlePortfolioRepository };

export async function createPortfolioAction(
  _prevState: FormActionState,
  formData: FormData,
): Promise<FormActionState> {
  const parsed = createPortfolioSchema.safeParse(Object.fromEntries(formData));

  if (!parsed.success) {
    return {
      status: "error",
      message: "Check the highlighted fields.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  try {
    const actor = await getActor();
    await createPortfolio(deps, actor, parsed.data);
  } catch (error) {
    return toErrorFormActionState(error);
  }

  revalidatePath("/portfolios");
  return { status: "success", message: `“${parsed.data.name}” created.` };
}

export async function renamePortfolioAction(
  _prevState: FormActionState,
  formData: FormData,
): Promise<FormActionState> {
  const parsed = renamePortfolioSchema.safeParse(Object.fromEntries(formData));

  if (!parsed.success) {
    return {
      status: "error",
      message: "Check the highlighted fields.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  try {
    const actor = await getActor();
    await renamePortfolio(deps, actor, { id: toPortfolioId(parsed.data.id), name: parsed.data.name });
  } catch (error) {
    return toErrorFormActionState(error);
  }

  revalidatePath("/portfolios");
  revalidatePath(`/portfolios/${parsed.data.id}`);
  return { status: "success", message: "Portfolio renamed." };
}

export async function deletePortfolioAction(
  _prevState: FormActionState,
  formData: FormData,
): Promise<FormActionState> {
  const parsed = deletePortfolioSchema.safeParse(Object.fromEntries(formData));

  if (!parsed.success) {
    return { status: "error", message: "Invalid request." };
  }

  try {
    const actor = await getActor();
    await deletePortfolio(deps, actor, toPortfolioId(parsed.data.id));
  } catch (error) {
    return toErrorFormActionState(error);
  }

  revalidatePath("/portfolios");
  return { status: "success", message: "Portfolio deleted." };
}
