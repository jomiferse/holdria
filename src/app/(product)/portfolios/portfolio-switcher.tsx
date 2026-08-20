"use client";

import { useParams, useRouter } from "next/navigation";

import { SelectNative } from "@/components/ui/select-native";
import type { Portfolio } from "@/modules/portfolio/domain/portfolio";

/** Navigates between the actor's own portfolios. Client-only: reads the current route param and pushes a new one. */
export function PortfolioSwitcher({ portfolios }: { portfolios: Portfolio[] }) {
  const router = useRouter();
  const params = useParams<{ portfolioId?: string }>();

  return (
    <label className="ml-auto flex items-center gap-2 text-sm">
      <span className="sr-only">Switch portfolio</span>
      <SelectNative
        className="w-auto"
        value={params.portfolioId ?? ""}
        onChange={(event) => {
          const id = event.target.value;
          router.push(id ? `/portfolios/${id}` : "/portfolios");
        }}
      >
        <option value="">All portfolios</option>
        {portfolios.map((portfolio) => (
          <option key={portfolio.id} value={portfolio.id}>
            {portfolio.name}
          </option>
        ))}
      </SelectNative>
    </label>
  );
}
