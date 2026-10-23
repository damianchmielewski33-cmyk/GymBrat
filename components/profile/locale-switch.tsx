"use client";

import { useI18n, type AppLocale } from "@/components/i18n/i18n-provider";
import { cn } from "@/lib/utils";

const OPTIONS: { id: AppLocale; label: string }[] = [
  { id: "pl", label: "Polski" },
  { id: "en", label: "English" },
];

export function LocaleSwitch() {
  const { locale, setLocale } = useI18n();

  return (
    <div className="grid grid-cols-2 gap-2" role="group" aria-label="Język interfejsu">
      {OPTIONS.map((opt) => {
        const active = locale === opt.id;
        return (
          <button
            key={opt.id}
            type="button"
            aria-pressed={active}
            onClick={() => setLocale(opt.id)}
            className={cn(
              "rounded-xl border px-4 py-3 text-sm font-semibold transition-colors",
              active
                ? "border-[var(--gym-gold)]/50 bg-[var(--gym-gold)]/15 text-[var(--gym-gold-bright)]"
                : "border-white/10 bg-black/25 text-white/80 hover:bg-white/[0.04]",
            )}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
