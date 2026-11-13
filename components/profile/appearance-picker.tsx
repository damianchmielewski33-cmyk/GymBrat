"use client";

import { Check } from "lucide-react";
import { useAppTheme } from "@/components/theme/use-app-theme";
import { APP_THEME_LABELS, type AppTheme } from "@/lib/app-theme";
import { cn } from "@/lib/utils";

const MAIN: { id: AppTheme; hint: string }[] = [
  { id: "gold", hint: "Klasyczny, stonowany" },
  { id: "pink", hint: "Błyszczący, odważny" },
];
const ACCENTS: AppTheme[] = ["violet", "teal", "red", "blue"];

/** Mały podgląd aplikacji w kolorach danego motywu (tokeny z `[data-theme]`). */
function ThemePreview({ theme }: { theme: AppTheme }) {
  return (
    <div
      data-theme={theme}
      aria-hidden
      className="flex h-[5.5rem] gap-2 rounded-xl border border-[rgba(var(--neon-rgb),0.35)] bg-[#09090a] p-2.5"
    >
      <div className="flex w-9 flex-col gap-1.5 rounded-lg border border-[var(--gym-border-gold)] bg-[#0d0d0f] p-1.5">
        <span className="h-1.5 rounded-full bg-[var(--gym-gold-bright)]" />
        <span className="h-1.5 rounded-full bg-white/20" />
        <span className="h-1.5 rounded-full bg-white/20" />
      </div>
      <div className="flex flex-1 flex-col gap-1.5">
        <span className="h-2 w-1/2 rounded-full bg-white/20" />
        <div className="flex-1 rounded-lg border border-[var(--gym-border-gold)] bg-[var(--gym-surface-gold)] p-1.5">
          <span className="text-[13px] font-extrabold text-[var(--gym-gold-bright)]">12 dni</span>
        </div>
        <span className="gold-btn h-6 rounded-lg" />
      </div>
    </div>
  );
}

export function AppearancePicker({ initialTheme }: { initialTheme: AppTheme }) {
  const { theme, choose, pending } = useAppTheme({ initial: initialTheme });

  return (
    <div className="space-y-5">
      <div className="grid gap-3" role="group" aria-label="Motyw aplikacji">
        {MAIN.map(({ id, hint }) => {
          const active = theme === id;
          return (
            <button
              key={id}
              type="button"
              disabled={pending}
              aria-pressed={active}
              onClick={() => choose(id)}
              className={cn(
                "space-y-3 rounded-2xl border-2 bg-black/30 p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 disabled:opacity-60",
                active ? "border-[var(--gym-gold)]" : "border-white/10 hover:border-white/25",
              )}
            >
              <ThemePreview theme={id} />
              <span className="flex items-center justify-between gap-2">
                <span className="flex flex-col leading-tight">
                  <span className="text-[15px] font-bold text-white">{APP_THEME_LABELS[id]}</span>
                  <span className="text-xs text-white/55">{hint}</span>
                </span>
                {active ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-[var(--gym-gold)] px-2.5 py-1 text-xs font-bold text-[var(--gym-on-gold)]">
                    <Check className="h-3.5 w-3.5" aria-hidden />
                    Aktywny
                  </span>
                ) : null}
              </span>
            </button>
          );
        })}
      </div>

      <div className="space-y-2.5">
        <p className="text-[13px] font-semibold text-white">
          Własny kolor akcentu <span className="font-normal text-white/50">· na czarnym tle</span>
        </p>
        <div className="grid grid-cols-4 gap-2.5" role="group" aria-label="Kolor akcentu">
          {ACCENTS.map((id) => {
            const active = theme === id;
            return (
              <button
                key={id}
                type="button"
                data-theme={id}
                disabled={pending}
                aria-pressed={active}
                onClick={() => choose(id)}
                className={cn(
                  "flex min-h-14 flex-col items-center justify-center gap-1.5 rounded-2xl border-2 bg-black/30 py-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 disabled:opacity-60",
                  active ? "border-[var(--gym-gold-bright)]" : "border-white/10 hover:border-white/25",
                )}
              >
                <span aria-hidden className="gold-btn h-6 w-6 rounded-full" />
                <span className="text-[11px] text-white/65">{APP_THEME_LABELS[id]}</span>
              </button>
            );
          })}
        </div>
      </div>

      <p className="text-[13px] leading-relaxed text-white/50">
        Zapisujemy wybór na Twoim koncie — będzie taki sam na każdym urządzeniu. Przełącznik złoto ↔ róż jest
        też na pasku bocznym.
      </p>
    </div>
  );
}
