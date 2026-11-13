"use client";

import { useCallback, useState, useTransition } from "react";
import { updateAppThemeAction } from "@/actions/app-theme";
import { useSaveFeedback } from "@/components/feedback/save-feedback";
import { parseAppTheme, type AppTheme } from "@/lib/app-theme";
import { applyAppTheme } from "@/lib/app-theme-client";

function currentTheme(): AppTheme {
  if (typeof document === "undefined") return "gold";
  return parseAppTheme(document.documentElement.dataset.theme);
}

/** Stan motywu + zapis na koncie (optymistycznie, z cofnięciem przy błędzie). */
export function useAppTheme(opts: { initial?: AppTheme; quiet?: boolean } = {}) {
  const { initial, quiet = false } = opts;
  const { notifySaved, notifyError } = useSaveFeedback();
  const [theme, setTheme] = useState<AppTheme>(initial ?? currentTheme());
  const [pending, start] = useTransition();

  const choose = useCallback(
    (next: AppTheme) => {
      if (pending || next === theme) return;
      const prev = theme;
      setTheme(next);
      applyAppTheme(next);
      start(async () => {
        const r = await updateAppThemeAction(next);
        if (r.ok) {
          if (!quiet) notifySaved("Motyw zapisany.");
        } else {
          setTheme(prev);
          applyAppTheme(prev);
          notifyError(r.error ?? "Nie udało się zapisać motywu.");
        }
      });
    },
    [pending, theme, quiet, notifySaved, notifyError],
  );

  return { theme, choose, pending };
}
