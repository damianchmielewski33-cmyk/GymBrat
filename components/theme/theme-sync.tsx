"use client";

import { useEffect } from "react";
import type { AppTheme } from "@/lib/app-theme";
import { applyAppTheme } from "@/lib/app-theme-client";

/** Wyrównuje motyw z kontem (np. po zalogowaniu na nowym urządzeniu). */
export function ThemeSync({ theme }: { theme: AppTheme }) {
  useEffect(() => {
    if (document.documentElement.dataset.theme !== theme) applyAppTheme(theme);
  }, [theme]);
  return null;
}
