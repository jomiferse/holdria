"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";
import type { ComponentProps } from "react";

/**
 * Applies the `dark` class to `<html>` based on system preference (see the
 * `.dark` token overrides in `globals.css`). Client-only: theme resolution
 * needs `window.matchMedia` and must not block server rendering.
 */
export function ThemeProvider({
  children,
  ...props
}: ComponentProps<typeof NextThemesProvider>) {
  return (
    <NextThemesProvider attribute="class" defaultTheme="system" enableSystem {...props}>
      {children}
    </NextThemesProvider>
  );
}
