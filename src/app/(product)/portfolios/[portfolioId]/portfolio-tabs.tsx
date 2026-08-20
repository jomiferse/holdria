"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

const TABS = [
  { segment: "", label: "Summary" },
  { segment: "operations", label: "Operations" },
  { segment: "instruments", label: "Instruments" },
  { segment: "prices", label: "Prices" },
  { segment: "allocation", label: "Allocation" },
  { segment: "history", label: "History" },
] as const;

/** Portfolio area navigation (spec: "clear access to its summary, operations, instruments or prices, allocation, and history"). */
export function PortfolioTabs({ portfolioId }: { portfolioId: string }) {
  const pathname = usePathname();
  const base = `/portfolios/${portfolioId}`;

  return (
    <nav aria-label="Portfolio sections" className="-mx-1 flex gap-1 overflow-x-auto border-b pb-px">
      {TABS.map((tab) => {
        const href = tab.segment ? `${base}/${tab.segment}` : base;
        const active = pathname === href;

        return (
          <Link
            key={tab.segment}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "shrink-0 rounded-t-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground",
              active && "border-b-2 border-primary text-foreground",
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
