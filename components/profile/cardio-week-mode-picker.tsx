"use client";

import { useState, useTransition } from "react";
import { updateCardioWeekModeAction } from "@/actions/cardio-week-mode";
import { useSaveFeedback } from "@/components/feedback/save-feedback";
import type { CardioWeekMode } from "@/lib/cardio-week-range";
import { cn } from "@/lib/utils";

const OPTIONS = [
  { id: "calendar", label: "Tydzień kalendarzowy", hint: "Pon–niedz, zeruje się w poniedziałek" },
  { id: "rolling", label: "Ostatnie 7 dni", hint: "Okno kroczące od dziś wstecz" },
] as const;

export function CardioWeekModePicker({ initialMode }: { initialMode: CardioWeekMode }) {
  const { notifySaved, notifyError } = useSaveFeedback();
  const [mode, setMode] = useState<CardioWeekMode>(initialMode);
  const [pending, start] = useTransition();

  function choose(next: CardioWeekMode) {
    if (next === mode || pending) return;
    const prev = mode;
    setMode(next);
    start(async () => {
      const r = await updateCardioWeekModeAction(next);
      if (r.ok && r.mode) {
        setMode(r.mode);
        notifySaved(
          r.mode === "rolling"
            ? "Cardio: liczymy ostatnie 7 dni."
            : "Cardio: liczymy tydzień pon–niedz.",
        );
      } else {
        setMode(prev);
        notifyError(r.error ?? "Nie udało się zapisać.");
      }
    });
  }

  return (
    <div className="grid grid-cols-2 gap-2" role="group" aria-label="Sposób liczenia tygodnia cardio">
      {OPTIONS.map((opt) => {
        const active = mode === opt.id;
        return (
          <button
            key={opt.id}
            type="button"
            disabled={pending}
            aria-pressed={active}
            onClick={() => choose(opt.id)}
            className={cn(
              "rounded-xl border px-4 py-3 text-left transition-colors disabled:opacity-60",
              active
                ? "border-[var(--gym-gold)]/50 bg-[var(--gym-gold)]/15"
                : "border-white/10 bg-black/25 hover:bg-white/[0.04]",
            )}
          >
            <p
              className={cn(
                "text-sm font-semibold",
                active ? "text-[var(--gym-gold-bright)]" : "text-white",
              )}
            >
              {opt.label}
            </p>
            <p className="mt-0.5 text-xs text-white/50">{opt.hint}</p>
          </button>
        );
      })}
    </div>
  );
}
