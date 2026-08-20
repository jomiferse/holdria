import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { InfoIcon } from "lucide-react";

/**
 * Placeholder for a portfolio section owned by a module not yet
 * implemented (ledger, pricing, analytics). Keeps navigation between
 * sections working without a 404, without pulling that module's business
 * logic into this change.
 */
export function ComingSoon({ title }: { title: string }) {
  return (
    <Alert>
      <InfoIcon />
      <AlertTitle>{title} is coming soon</AlertTitle>
      <AlertDescription>
        This section will be available once operations and pricing are implemented.
      </AlertDescription>
    </Alert>
  );
}
