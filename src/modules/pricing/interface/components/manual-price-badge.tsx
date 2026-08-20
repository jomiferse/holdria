import { Badge } from "@/components/ui/badge";

/**
 * Labels a price by its source and date. Always "Manual" for this change
 * (only source implemented) — deliberately never "Live" or "Real-time",
 * per the pricing spec's provenance requirement.
 */
export function ManualPriceBadge({ effectiveDate }: { readonly effectiveDate: string }) {
  return (
    <Badge variant="outline" title={`Manually entered price as of ${effectiveDate}`}>
      Manual · as of {effectiveDate}
    </Badge>
  );
}
