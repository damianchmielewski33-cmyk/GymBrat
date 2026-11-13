"use client";

import { ArrowLeftRight } from "lucide-react";
import { APP_THEME_LABELS, nextQuickTheme } from "@/lib/app-theme";
import { cn } from "@/lib/utils";
import { useAppTheme } from "@/components/theme/use-app-theme";

/** Przycisk zmiany motywu na pasku bocznym: złoto ↔ róż (pozostałe kolory: Profil → Wygląd). */
export function ThemeToggleButton({ className }: { className?: string }) {
  const { theme, choose, pending } = useAppTheme({ quiet: true });
  const next = nextQuickTheme(theme);
  return (
    <button
      type="button"
      onClick={() => choose(next)}
      disabled={pending}
      aria-label={`Zmień motyw na: ${APP_THEME_LABELS[next]}`}
      className={cn(
        "flex min-h-[3.25rem] w-full items-center gap-3 rounded-2xl border border-[var(--gym-border-gold)] bg-[rgba(var(--neon-rgb),0.10)] px-3 py-2 text-left transition-colors hover:bg-[rgba(var(--neon-rgb),0.16)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--gym-gold)]/60 disabled:opacity-60",
        className,
      )}
    >
      <span
        aria-hidden
        className="gold-btn h-8 w-8 shrink-0 rounded-full"
      />
      <span className="flex min-w-0 flex-1 flex-col leading-tight">
        <span className="text-[length:var(--text-label)] uppercase tracking-[0.08em] text-white/55">
          Motyw
        </span>
        <span className="truncate text-sm font-semibold text-white">
          {APP_THEME_LABELS[theme]}
        </span>
      </span>
      <ArrowLeftRight className="h-[1.125rem] w-[1.125rem] shrink-0 text-[var(--gym-gold)]" aria-hidden />
    </button>
  );
}
