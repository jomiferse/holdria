import { AlertCircle } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";

/** Accessible, live-announced form-level error banner shared by every identity form. */
export function FormError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <Alert variant="destructive" role="alert" aria-live="assertive">
      <AlertCircle />
      <AlertDescription>{message}</AlertDescription>
    </Alert>
  );
}

/** Field-level validation message, associated to its input via `id`. */
export function FieldError({ id, errors }: { id: string; errors?: string[] }) {
  if (!errors?.length) return null;
  return (
    <p id={id} role="alert" className="text-sm text-destructive">
      {errors[0]}
    </p>
  );
}
