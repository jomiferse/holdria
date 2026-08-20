"use client";

import { useState, useTransition } from "react";

import { idleFormActionState, type FormActionState } from "@/shared/application/form-action-state";

type FormActionFn = (prevState: FormActionState, formData: FormData) => Promise<FormActionState>;

/**
 * Drives a Server Action from a Client Component without `useActionState`.
 * `useActionState`'s returned state can only be reacted to from a
 * `useEffect`, and React's `set-state-in-effect` rule (correctly) flags
 * the resulting "close the dialog / show a toast on success" pattern as
 * an effect that exists only to synchronize with an event, not an
 * external system. Calling the action inside the transition started by
 * `dispatch`, and handling its result there, keeps that logic in an
 * event-handling context instead.
 */
export function useFormAction(action: FormActionFn, onSettled?: (state: FormActionState) => void) {
  const [state, setState] = useState<FormActionState>(idleFormActionState);
  const [pending, startTransition] = useTransition();

  function dispatch(formData: FormData) {
    startTransition(async () => {
      const result = await action(state, formData);
      setState(result);
      onSettled?.(result);
    });
  }

  return [state, dispatch, pending] as const;
}
