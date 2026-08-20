import { NotFoundError } from "@/shared/domain/errors";
import type { Actor } from "@/modules/identity/application/actor";
import type { Instrument, InstrumentId } from "../domain/instrument";
import type { InstrumentRepository } from "./instrument-repository";

export interface InstrumentQueryDeps {
  repository: InstrumentRepository;
}

/** Lists every instrument the actor owns. */
export async function listInstruments(deps: InstrumentQueryDeps, actor: Actor): Promise<Instrument[]> {
  return deps.repository.listOwned(actor.userId);
}

/** Loads one owned instrument, or throws `NotFoundError`. */
export async function getInstrument(
  deps: InstrumentQueryDeps,
  actor: Actor,
  id: InstrumentId,
): Promise<Instrument> {
  const instrument = await deps.repository.findOwnedById(actor.userId, id);

  if (!instrument) {
    throw new NotFoundError("Instrument not found.");
  }

  return instrument;
}
