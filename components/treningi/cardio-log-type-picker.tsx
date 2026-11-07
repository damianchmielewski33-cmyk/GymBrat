"use client";

import {
  CARDIO_TYPE_LABELS_PL,
  CARDIO_TYPE_SLUGS,
  type CardioTypeSlug,
} from "@/lib/cardio-utils";
import { cn } from "@/lib/utils";

type Props = {
  value: CardioTypeSlug;
  onChange: (slug: CardioTypeSlug) => void;
  disabled?: boolean;
};

export function CardioLogTypePicker({ value, onChange, disabled }: Props) {
  return (
    <div>
      <p className="mb-1.5 px-0.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--gym-text-secondary)]">
        Rodzaj aktywności
      </p>
      <div
        role="group"
        aria-label="Rodzaj cardio"
        className="grid grid-cols-4 gap-1.5"
      >
        {CARDIO_TYPE_SLUGS.map((slug) => {
          const pressed = slug === value;
          return (
            <button
              key={slug}
              type="button"
              disabled={disabled}
              aria-pressed={pressed}
              onClick={() => onChange(slug)}
              className={cn(
                "inline-flex min-h-11 items-center justify-center rounded-full border px-1 text-[12px] font-semibold transition-all duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)] motion-reduce:transition-none",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]",
                pressed
                  ? "scale-[1.04] border-[#f6e3a1]/80 bg-gradient-to-b from-[#f6e3a1] to-[var(--gym-gold)] text-[var(--neon-fg)] shadow-[0_4px_14px_rgba(var(--neon-rgb),0.35)]"
                  : "border-white/10 bg-white/[0.05] text-white/75 hover:bg-white/[0.08]",
                disabled && "opacity-60",
              )}
            >
              {CARDIO_TYPE_LABELS_PL[slug]}
            </button>
          );
        })}
      </div>
    </div>
  );
}
