"use client";

import type { Ref } from "react";
import { Minus, Plus } from "lucide-react";
import { CARDIO_INPUT_LIMITS } from "@/lib/cardio-utils";
import { cn } from "@/lib/utils";

const PRESETS = [15, 30, 45, 60] as const;

type Props = {
  minutesText: string;
  onMinutesTextChange: (v: string) => void;
  error: string | null;
  disabled?: boolean;
  errorId: string;
  inputRef?: Ref<HTMLInputElement>;
};

export function CardioLogMinutesField({
  minutesText,
  onMinutesTextChange,
  error,
  disabled,
  errorId,
  inputRef,
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
            "h-14 w-28 rounded-xl border bg-black/35 text-center font-metric text-4xl tabular-nums outline-none",
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
                "inline-flex min-h-11 items-center rounded-full border px-3.5 text-[13px] font-semibold tabular-nums",
                active
                  ? "border-[rgba(235,196,74,0.55)] bg-[rgba(235,196,74,0.12)] text-[var(--gym-gold)]"
                  : "border-white/10 text-white/70",
              )}
            >
              {p} min
            </button>
          );
        })}
      </div>

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
