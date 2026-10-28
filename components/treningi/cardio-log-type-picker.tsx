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
    <div
      role="group"
      aria-label="Rodzaj cardio"
      className="grid grid-cols-4 gap-2"
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
              "inline-flex min-h-11 items-center justify-center rounded-full border px-2 text-[12px] font-semibold transition",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]",
              pressed
                ? "border-[rgba(235,196,74,0.55)] bg-[rgba(235,196,74,0.14)] text-[var(--gym-gold)]"
                : "border-white/10 bg-white/[0.03] text-white/70 hover:bg-white/[0.06]",
              disabled && "opacity-60",
            )}
          >
            {CARDIO_TYPE_LABELS_PL[slug]}
          </button>
        );
      })}
    </div>
  );
}
