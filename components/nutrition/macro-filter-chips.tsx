"use client";

import type { MacroKey } from "@/lib/nutrition-day-balance";
import { cn } from "@/lib/utils";

export type MacroFilter = "all" | MacroKey;

const CHIPS: { id: MacroFilter; label: string }[] = [
  { id: "all", label: "Wszystkie" },
  { id: "calories", label: "Kalorie" },
  { id: "protein", label: "Białko" },
  { id: "carbs", label: "Węgle" },
  { id: "fat", label: "Tłuszcz" },
];

export function MacroFilterChips({
  value,
  counts,
  onChange,
}: {
  value: MacroFilter;
  counts: Record<MacroFilter, number>;
  onChange: (next: MacroFilter) => void;
}) {
  return (
    <div
      role="group"
      aria-label="Filtruj odchylenia po makro"
      className="chip-scroll -mx-0.5 px-0.5"
    >
      {CHIPS.map((chip) => {
        const active = value === chip.id;
        const count = counts[chip.id] ?? 0;
        return (
          <button
            key={chip.id}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(chip.id)}
            className={cn(
              "inline-flex h-11 shrink-0 items-center rounded-full border px-3 text-[12px] font-semibold tabular-nums",
              active
                ? "border-[color-mix(in_srgb,var(--gym-gold)_60%,transparent)] text-white"
                : "border-[var(--gym-border-gold)] text-white/80",
            )}
          >
            {chip.label} {count}
          </button>
        );
      })}
    </div>
  );
}
