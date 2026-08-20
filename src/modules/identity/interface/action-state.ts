/**
 * Shared Server Action result shape for every identity form. Kept in a
 * plain (non `"use server"`) module because a `"use server"` file may only
 * export async functions — types and the `idleActionState` constant used
 * by `useActionState`'s initial value would otherwise fail the build.
 */
export type ActionState = {
  status: "idle" | "error" | "success";
  message?: string;
  fieldErrors?: Record<string, string[]>;
  /** Safe (non-password) input, preserved so a failed submission does not
   * force the user to retype it (identity spec: "Authentication request
   * fails"). */
  values?: Record<string, string>;
};

export const idleActionState: ActionState = { status: "idle" };
