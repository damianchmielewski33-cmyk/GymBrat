"use client";

import { Check } from "lucide-react";
import { APP_THEMES, APP_THEME_LABELS } from "@/lib/app-theme";
import { cn } from "@/lib/utils";
import { useAppTheme } from "@/components/theme/use-app-theme";

/** Wybór motywu na pasku bocznym i w menu: wszystkie kolory jednym dotknięciem. */
export function ThemeToggleButton({ className }: { className?: string }) {
  const { theme, choose, pending } = useAppTheme({ quiet: true });
  return (
    <div
      className={cn(
        "w-full space-y-2 rounded-2xl border border-[var(--gym-border-gold)] bg-[rgba(var(--neon-rgb),0.10)] p-3",
        className,
      )}
    >
      <div className="flex items-baseline justify-between gap-2 leading-tight">
        <span className="text-[length:var(--text-label)] uppercase tracking-[0.08em] text-white/55">
          Motyw
        </span>
        <span className="truncate text-sm font-semibold text-white">{APP_THEME_LABELS[theme]}</span>
      </div>
      <div className="flex items-center justify-between gap-1" role="group" aria-label="Motyw aplikacji">
        {APP_THEMES.map((id) => {
          const active = theme === id;
          return (
            <button
              key={id}
              type="button"
              data-theme={id}
              disabled={pending}
              aria-pressed={active}
              aria-label={APP_THEME_LABELS[id]}
              title={APP_THEME_LABELS[id]}
              onClick={() => choose(id)}
              className={cn(
                "gold-btn relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:ring-offset-2 focus-visible:ring-offset-black disabled:opacity-60",
                active && "scale-110 ring-2 ring-white/80 ring-offset-2 ring-offset-black",
              )}
            >
              {active ? <Check className="h-4 w-4" strokeWidth={3} aria-hidden /> : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}
