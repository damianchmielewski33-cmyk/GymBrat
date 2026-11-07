"use client";

import type { Ref } from "react";
import { Minus, Plus } from "lucide-react";
import { CARDIO_INPUT_LIMITS, type CardioTypeSlug } from "@/lib/cardio-utils";
import { cn } from "@/lib/utils";

const PRESETS = [15, 30, 45, 60] as const;

/** Przybliżone spalanie (kcal/min) dla ~70 kg — tylko orientacyjny podgląd. */
const KCAL_PER_MIN: Record<CardioTypeSlug, number> = {
  walk: 4,
  treadmill: 8,
  bike: 7,
  elliptical: 8,
  stairs: 9,
  run: 11,
  swim: 9,
  other: 6,
};

type Props = {
  minutesText: string;
  onMinutesTextChange: (v: string) => void;
  error: string | null;
  disabled?: boolean;
  errorId: string;
  inputRef?: Ref<HTMLInputElement>;
  /** Rodzaj aktywności — do szacunku kcal. */
  machine?: CardioTypeSlug;
};

export function CardioLogMinutesField({
  minutesText,
  onMinutesTextChange,
  error,
  disabled,
  errorId,
  inputRef,
  machine,
}: Props) {
  const parsed = /^\d+$/.test(minutesText.trim())
    ? Number(minutesText.trim())
    : null;
  const atMin = parsed != null && parsed <= 1;
  const atMax =
    parsed != null && parsed >= CARDIO_INPUT_LIMITS.minutesMax;

  function step(delta: number) {
    const base =
      parsed != null && parsed >= 1 ? parsed : 30;
    const next = Math.min(
      CARDIO_INPUT_LIMITS.minutesMax,
      Math.max(1, base + delta),
    );
    onMinutesTextChange(String(next));
  }

  return (
    <div className="app-panel px-4 py-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white">
          Czas{" "}
          <span className="text-[var(--gym-gold)]">· wymagane</span>
        </p>
        <p className="text-[11px] text-[var(--gym-text-secondary)]">
          1–{CARDIO_INPUT_LIMITS.minutesMax} min
        </p>
      </div>

      <div className="mt-3 flex items-center justify-center gap-3">
        <button
          type="button"
          aria-label="Mniej o 5 minut"
          disabled={disabled || atMin}
          onClick={() => step(-5)}
          className="inline-flex h-14 w-14 items-center justify-center rounded-full border border-white/12 bg-white/[0.04] text-white transition hover:bg-white/[0.08] disabled:opacity-40"
        >
          <Minus className="h-5 w-5" aria-hidden />
        </button>
        <input
          ref={inputRef}
          type="text"
          inputMode="numeric"
          value={minutesText}
          disabled={disabled}
          aria-invalid={error != null}
          aria-describedby={error ? errorId : undefined}
          aria-label="Minuty"
          onChange={(e) => onMinutesTextChange(e.target.value)}
          className={cn(
            "h-14 w-28 rounded-2xl border bg-black/50 text-center font-metric text-4xl tabular-nums outline-none",
            "focus:ring-2 focus:ring-[var(--gym-gold)]/25",
            error
              ? "border-[var(--destructive)] text-white"
              : "border-[var(--gym-gold)]/40 text-[var(--gym-gold)] focus:border-[var(--gym-gold)]",
          )}
        />
        <button
          type="button"
          aria-label="Więcej o 5 minut"
          disabled={disabled || atMax}
          onClick={() => step(5)}
          className="inline-flex h-14 w-14 items-center justify-center rounded-full border border-white/12 bg-white/[0.04] text-white transition hover:bg-white/[0.08] disabled:opacity-40"
        >
          <Plus className="h-5 w-5" aria-hidden />
        </button>
      </div>

      <div className="mt-3 flex flex-wrap justify-center gap-2">
        {PRESETS.map((p) => {
          const active = parsed === p;
          return (
            <button
              key={p}
              type="button"
              disabled={disabled}
              aria-pressed={active}
              onClick={() => onMinutesTextChange(String(p))}
              className={cn(
                "inline-flex min-h-11 items-center rounded-full border px-3.5 text-[13px] font-semibold tabular-nums transition-all duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)] motion-reduce:transition-none",
                active
                  ? "scale-[1.04] border-[#f6e3a1]/80 bg-gradient-to-b from-[#f6e3a1] to-[var(--gym-gold)] text-[var(--neon-fg)] shadow-[0_4px_14px_rgba(var(--neon-rgb),0.35)]"
                  : "border-white/10 bg-white/[0.05] text-white/75",
              )}
            >
              {p} min
            </button>
          );
        })}
      </div>

      {machine && parsed != null && parsed > 0 ? (
        <p className="mt-3 flex items-center justify-between text-[12px] text-white/65">
          <span>Szacunkowe spalanie</span>
          <span className="text-[14px] font-bold tabular-nums text-[var(--gym-gold-bright)]">
            ≈ {Math.round(parsed * KCAL_PER_MIN[machine])} kcal
          </span>
        </p>
      ) : null}

      {error ? (
        <p
          id={errorId}
          role="alert"
          className="mt-2 text-center text-[12px] text-[#ff8593]"
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}
