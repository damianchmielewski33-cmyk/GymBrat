"use client";

import { useEffect, useState, useTransition } from "react";
import { Percent, Scale } from "lucide-react";
import { updateProgressDeltaUnitAction } from "@/actions/progress-delta-unit";
import { useSaveFeedback } from "@/components/feedback/save-feedback";
import {
  parseProgressDeltaUnit,
  writeProgressDeltaUnitLocal,
  type ProgressDeltaUnit,
} from "@/lib/progress-delta-unit";
import { cn } from "@/lib/utils";

export function ProgressDeltaUnitCard({
  initialUnit,
}: {
  initialUnit: ProgressDeltaUnit;
}) {
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
    <section className="app-card p-5 sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="app-label text-[var(--gym-gold)]">Postępy</p>
          <h2 className="mt-1.5 text-lg font-semibold text-white">
            Jednostka porównań
          </h2>
          <p className="mt-1.5 text-sm leading-relaxed text-white/45">
            Delty tonażu i objętości (Historia, popup po treningu) w % albo w kg.
          </p>
        </div>
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[var(--gym-gold)]/30 bg-[var(--gym-gold)]/10">
          {unit === "kg" ? (
            <Scale className="h-5 w-5 text-[var(--gym-gold)]" aria-hidden />
          ) : (
            <Percent className="h-5 w-5 text-[var(--gym-gold)]" aria-hidden />
          )}
        </div>
      </div>
      <div
        className="mt-5 grid grid-cols-2 gap-2"
        role="group"
        aria-label="Jednostka postępów"
      >
        {(
          [
            { id: "percent", label: "Procenty", hint: "np. +8%" },
            { id: "kg", label: "Kilogramy", hint: "np. +120 kg" },
          ] as const
        ).map((opt) => {
          const active = unit === opt.id;
          return (
            <button
              key={opt.id}
              type="button"
              disabled={pending}
              aria-pressed={active}
              onClick={() => choose(parseProgressDeltaUnit(opt.id))}
              className={cn(
                "rounded-2xl border px-4 py-3.5 text-left transition disabled:opacity-60",
                active
                  ? "border-[var(--gym-gold)]/45 bg-[var(--gym-gold)]/15"
                  : "border-white/10 bg-black/20 hover:bg-white/[0.04]",
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
    </section>
  );
}
