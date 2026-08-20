import { isDomainError, ValidationError } from "@/shared/domain/errors";

/**
 * Shared `useActionState` result shape for every module's mutation
 * Server Actions, so forms preserve safe input and render field-level
 * errors consistently instead of each module inventing its own shape.
 */
export type FormActionState =
  | { status: "idle" }
  | { status: "error"; message: string; fieldErrors?: Record<string, string[]> }
  | { status: "success"; message: string };

export const idleFormActionState: FormActionState = { status: "idle" };

/**
 * Maps a caught error to a `FormActionState`. Expected `DomainError`s
 * (validation, not-found, conflict, unauthorized, invariant) become a
 * user-facing message; anything else is rethrown so it surfaces as an
 * unexpected error rather than being silently swallowed.
 */
export function toErrorFormActionState(error: unknown): FormActionState {
  if (!isDomainError(error)) {
    throw error;
  }

  return {
    status: "error",
    message: error.message,
    fieldErrors: error instanceof ValidationError ? error.fieldErrors : undefined,
  };
}
