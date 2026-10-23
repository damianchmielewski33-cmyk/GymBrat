"use client";

import { useEffect, useState, useTransition } from "react";
import { updateProgressDeltaUnitAction } from "@/actions/progress-delta-unit";
import { useSaveFeedback } from "@/components/feedback/save-feedback";
import {
  parseProgressDeltaUnit,
  writeProgressDeltaUnitLocal,
  type ProgressDeltaUnit,
} from "@/lib/progress-delta-unit";
import { cn } from "@/lib/utils";

const OPTIONS = [
  { id: "percent", label: "Procenty", hint: "np. +8%" },
  { id: "kg", label: "Kilogramy", hint: "np. +120 kg" },
] as const;

export function ProgressDeltaUnitPicker({ initialUnit }: { initialUnit: ProgressDeltaUnit }) {
  const { notifySaved, notifyError } = useSaveFeedback();
  const [unit, setUnit] = useState<ProgressDeltaUnit>(initialUnit);
  const [pending, start] = useTransition();

  useEffect(() => {
    setUnit(initialUnit);
    writeProgressDeltaUnitLocal(initialUnit);
  }, [initialUnit]);

  function choose(next: ProgressDeltaUnit) {
    if (next === unit || pending) return;
    const prev = unit;
    setUnit(next);
    writeProgressDeltaUnitLocal(next);
    start(async () => {
      const r = await updateProgressDeltaUnitAction(next);
      if (r.ok && r.unit) {
        setUnit(r.unit);
        writeProgressDeltaUnitLocal(r.unit);
        notifySaved(
          r.unit === "kg"
            ? "Postępy: porównania w kilogramach."
            : "Postępy: porównania w procentach.",
        );
      } else {
        setUnit(prev);
        writeProgressDeltaUnitLocal(prev);
        notifyError(r.error ?? "Nie udało się zapisać.");
      }
    });
  }

  return (
    <div className="grid grid-cols-2 gap-2" role="group" aria-label="Jednostka postępów">
      {OPTIONS.map((opt) => {
        const active = unit === opt.id;
        return (
          <button
            key={opt.id}
            type="button"
            disabled={pending}
            aria-pressed={active}
            onClick={() => choose(parseProgressDeltaUnit(opt.id))}
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
            <p className="mt-0.5 text-xs text-white/45">{opt.hint}</p>
          </button>
        );
      })}
    </div>
  );
}
