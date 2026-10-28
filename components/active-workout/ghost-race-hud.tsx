"use client";

import { useEffect } from "react";
import { computeGhostDelta } from "@/lib/ghost-training/deltas";
import type { GhostDelta } from "@/lib/ghost-training/types";
import { useActiveWorkoutStore } from "@/lib/stores/active-workout";
import { useGhostTrainingStore } from "@/lib/stores/ghost-training";
import { cn } from "@/lib/utils";

function sessionElapsed(startedAt: number | null, paused: number): number {
  if (!startedAt) return paused;
  return paused + Math.max(0, Math.floor((Date.now() - startedAt) / 1000));
}

/**
 * Liczy wynik wyścigu Ghost co sekundę (gdy wybrano rywala). Wołany raz na ekranie
 * sesji, niezależnie od tego, czy panel z HUD jest otwarty (plakietka pokazuje wynik).
 */
export function useGhostRaceTicker() {
  const timeline = useGhostTrainingStore((s) => s.timeline);
  const setDelta = useGhostTrainingStore((s) => s.setDelta);
  const exercises = useActiveWorkoutStore((s) => s.exercises);
  const startedAt = useActiveWorkoutStore((s) => s.startedAt);
  const paused = useActiveWorkoutStore((s) => s.pausedElapsedSeconds);

  useEffect(() => {
    if (!timeline) return;
    const tick = () => {
      const mySets = exercises.reduce(
        (n, ex) => n + ex.sets.filter((s) => s.done && !s.skipped).length,
        0,
      );
      const myVol = exercises.reduce(
        (n, ex) =>
          n +
          ex.sets
            .filter((s) => s.done && !s.skipped)
            .reduce((v, s) => v + (s.weight || 0) * (s.reps || 0), 0),
        0,
      );
      const totalSets = Math.max(
        1,
        exercises.reduce((n, ex) => n + ex.sets.length, 0),
      );
      const myPct = Math.round((mySets / totalSets) * 100);
      setDelta(
        computeGhostDelta({
          timeline,
          myElapsedSeconds: sessionElapsed(startedAt, paused),
          myCompletedSets: mySets,
          myVolumeKg: myVol,
          myProgressPct: myPct,
        }),
      );
    };
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [timeline, exercises, startedAt, paused, setDelta]);
}

const PREDICTED_CLASS: Record<GhostDelta["predicted"], string> = {
  winning: "text-[var(--gym-trend-up)]",
  trailing: "text-[var(--gym-trend-down)]",
  neck: "text-[var(--gym-gold)]",
};

function signed(n: number, suffix = ""): string {
  if (n > 0) return `+${n}${suffix}`;
  if (n < 0) return `−${Math.abs(n)}${suffix}`;
  return `0${suffix}`;
}

/** Szczegóły wyścigu Ghost (w panelu plakietki). Wynik zawsze z tekstem. */
export function GhostRaceHud() {
  const timeline = useGhostTrainingStore((s) => s.timeline);
  const delta = useGhostTrainingStore((s) => s.delta);

  if (!timeline || !delta) return null;

  return (
    <div className="rounded-2xl border border-[var(--gym-border-gold)] bg-[var(--gym-black)] p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] uppercase tracking-wide text-[var(--gym-gold)]">
          Ghost · {timeline.sourceLabel}
          {timeline.synthetic ? " · szacunek" : ""}
        </p>
        <p className={cn("text-[12px] font-semibold", PREDICTED_CLASS[delta.predicted])}>
          {delta.predictedLabel}
        </p>
      </div>
      <div className="mt-2 grid grid-cols-3 gap-2 text-center">
        <div>
          <p className="text-[11px] text-[var(--gym-text-secondary)]">Czas</p>
          <p className="font-heading text-[15px] tabular-nums text-white">
            {signed(delta.timeDeltaSeconds, " s")}
          </p>
        </div>
        <div>
          <p className="text-[11px] text-[var(--gym-text-secondary)]">Serie</p>
          <p className="font-heading text-[15px] tabular-nums text-white">
            {signed(delta.setsDelta)}
          </p>
        </div>
        <div>
          <p className="text-[11px] text-[var(--gym-text-secondary)]">Progres</p>
          <p className="font-heading text-[15px] tabular-nums text-white">
            {signed(delta.progressDeltaPct, "%")}
          </p>
        </div>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[var(--gym-track)]" aria-hidden>
        <div
          className="h-full bg-[var(--gym-gold)] transition-[width] motion-reduce:transition-none"
          style={{
            width: `${Math.min(100, Math.max(5, 50 + delta.progressDeltaPct / 2))}%`,
          }}
        />
      </div>
      {delta.ghostExerciseName ? (
        <p className="mt-2 text-[11px] text-[var(--gym-text-secondary)]">
          Ghost był na: {delta.ghostExerciseName}
        </p>
      ) : null}
    </div>
  );
}
