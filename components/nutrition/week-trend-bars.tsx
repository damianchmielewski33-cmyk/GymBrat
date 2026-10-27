"use client";

import { useState } from "react";
import {
  formatPlNumber,
  type WeekTrendDay,
} from "@/lib/nutrition-day-balance";
import { cn } from "@/lib/utils";

export function WeekTrendBars({ days }: { days: WeekTrendDay[] }) {
  const today = days.find((d) => d.kind === "today");
  const [selected, setSelected] = useState<string | null>(
    today && today.kind === "today" && today.caloriesConsumed > 0
      ? today.dateKey
      : null,
  );
  const active = days.find((d) => d.dateKey === selected) ?? null;

  return (
    <div className="mt-4 border-t border-[var(--gym-border-gold)] pt-4">
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--gym-text-secondary)]">
        Kalorie dnia, % celu
      </p>
      <div
        role="group"
        aria-label="Kalorie dnia w tygodniu, procent celu"
        className="mt-3 flex items-end justify-between gap-0.5"
        style={{ height: 72 }}
      >
        {days.map((d) => {
          const pct = d.kcalPct == null ? 0 : Math.min(150, Math.max(0, d.kcalPct));
          const h = d.kind === "empty" || d.kind === "no_goal" ? 0 : (pct / 150) * 100;
          const isSelected = selected === d.dateKey;
          return (
            <button
              key={d.dateKey}
              type="button"
              aria-label={d.ariaLabel}
              aria-pressed={isSelected}
              onClick={() => setSelected(d.dateKey)}
              className="flex h-full w-full max-w-[44px] flex-1 flex-col items-center justify-end gap-1"
            >
              <div className="relative flex h-[56px] w-full items-end justify-center">
                <div
                  className="absolute inset-x-1 top-[calc(100%/1.5)] h-px border-t border-dashed border-[var(--gym-text-secondary)]/60"
                  aria-hidden
                />
                {d.kind === "empty" ? (
                  <span className="mb-2 text-[12px] text-[var(--gym-text-secondary)]">
                    —
                  </span>
                ) : d.kind === "no_goal" ? (
                  <div className="w-[55%] rounded-sm border border-dashed border-[var(--gym-text-secondary)]/50 bg-[var(--gym-track)]" style={{ height: "40%" }} />
                ) : (
                  <div
                    className={cn(
                      "w-[55%] rounded-sm transition-[height] duration-300 motion-reduce:transition-none",
                      d.kind === "today"
                        ? "border border-dashed border-[var(--gym-gold)] bg-[color-mix(in_srgb,var(--gym-gold)_25%,transparent)]"
                        : "bg-[color-mix(in_srgb,var(--gym-gold)_70%,transparent)]",
                      isSelected && "ring-1 ring-[var(--gym-gold)]",
                    )}
                    style={{ height: `${Math.max(8, h)}%` }}
                  />
                )}
              </div>
              <span
                className={cn(
                  "text-[11px] text-[var(--gym-text-secondary)]",
                  d.kind === "today" && "font-semibold text-white",
                )}
              >
                {d.kind === "today" ? "dziś" : d.weekdayShort}
              </span>
              {d.kind === "empty" ? (
                <span className="sr-only">brak</span>
              ) : null}
            </button>
          );
        })}
      </div>
      {active ? (
        <p className="mt-2 text-[12px] tabular-nums text-[var(--gym-text-secondary)]" aria-live="polite">
          {active.label}
          {active.kind === "empty"
            ? " · brak wpisów"
            : active.caloriesGoal != null
              ? ` · ${formatPlNumber(active.caloriesConsumed)} z ${formatPlNumber(active.caloriesGoal)} kcal${active.kcalPct != null ? ` · ${active.kcalPct}%` : ""}`
              : ` · ${formatPlNumber(active.caloriesConsumed)} kcal · brak celu`}
        </p>
      ) : null}
      <ul className="sr-only">
        {days.map((d) => (
          <li key={`sr-${d.dateKey}`}>{d.ariaLabel}</li>
        ))}
      </ul>
    </div>
  );
}
