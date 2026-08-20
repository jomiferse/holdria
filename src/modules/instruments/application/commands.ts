import { NotFoundError } from "@/shared/domain/errors";
import type { Actor } from "@/modules/identity/application/actor";
import { normalizeInstrumentInput, type Instrument, type InstrumentId, type InstrumentInput } from "../domain/instrument";
import type { InstrumentRepository } from "./instrument-repository";

export interface InstrumentCommandDeps {
  repository: InstrumentRepository;
}

export async function createInstrument(
  deps: InstrumentCommandDeps,
  actor: Actor,
  input: InstrumentInput,
): Promise<Instrument> {
  const normalized = normalizeInstrumentInput(input);
  return deps.repository.create(actor.userId, normalized);
}

export interface UpdateInstrumentInput extends InstrumentInput {
  id: InstrumentId;
}

export async function updateInstrument(
  deps: InstrumentCommandDeps,
  actor: Actor,
  input: UpdateInstrumentInput,
): Promise<Instrument> {
  const normalized = normalizeInstrumentInput(input);
  const updated = await deps.repository.update(actor.userId, input.id, normalized);

  if (!updated) {
    throw new NotFoundError("Instrument not found.");
  }

  return updated;
}

export async function deleteInstrument(
  deps: InstrumentCommandDeps,
  actor: Actor,
  id: InstrumentId,
): Promise<void> {
  const deleted = await deps.repository.delete(actor.userId, id);

  if (!deleted) {
    throw new NotFoundError("Instrument not found.");
  }
}
