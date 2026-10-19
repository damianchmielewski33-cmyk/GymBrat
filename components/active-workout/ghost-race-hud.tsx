"use client";

import { useEffect } from "react";
import { computeGhostDelta } from "@/lib/ghost-training/deltas";
import { useActiveWorkoutStore } from "@/lib/stores/active-workout";
import { useGhostTrainingStore } from "@/lib/stores/ghost-training";

function sessionElapsed(startedAt: number | null, paused: number): number {
  if (!startedAt) return paused;
  return paused + Math.max(0, Math.floor((Date.now() - startedAt) / 1000));
}

export function GhostRaceHud() {
  const timeline = useGhostTrainingStore((s) => s.timeline);
  const delta = useGhostTrainingStore((s) => s.delta);
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

  if (!timeline || !delta) return null;

  const timeLabel =
    delta.timeDeltaSeconds <= 0
      ? `${Math.abs(delta.timeDeltaSeconds)}s szybciej`
      : `+${delta.timeDeltaSeconds}s`;

  const predictedClass =
    delta.predicted === "winning"
      ? "text-emerald-300"
      : delta.predicted === "trailing"
        ? "text-rose-300"
        : "text-[var(--gym-gold)]";

  return (
    <div className="rounded-2xl border border-[var(--neon)]/30 bg-black/55 p-3 backdrop-blur-md">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] uppercase tracking-wide text-[var(--neon)]/80">
          Ghost · {timeline.sourceLabel}
          {timeline.synthetic ? " · szacunek" : ""}
        </p>
        <p className={`text-[12px] font-medium ${predictedClass}`}>
          {delta.predictedLabel}
        </p>
      </div>
      <div className="mt-2 grid grid-cols-3 gap-2 text-center">
        <div>
          <p className="text-[10px] text-white/40">Czas</p>
          <p className="font-metric text-[15px] text-white">{timeLabel}</p>
        </div>
        <div>
          <p className="text-[10px] text-white/40">Serie</p>
          <p className="font-metric text-[15px] text-white">
            {delta.setsDelta >= 0 ? "+" : ""}
            {delta.setsDelta}
          </p>
        </div>
        <div>
          <p className="text-[10px] text-white/40">Progres</p>
          <p className="font-metric text-[15px] text-white">
            {delta.progressDeltaPct >= 0 ? "+" : ""}
            {delta.progressDeltaPct}%
          </p>
        </div>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
        <div className="flex h-full">
          <div
            className="h-full bg-[var(--neon)]/80 transition-all"
            style={{
              width: `${Math.min(100, Math.max(5, 50 + delta.progressDeltaPct / 2))}%`,
            }}
          />
          <div className="h-full flex-1 bg-white/20" />
        </div>
      </div>
      {delta.ghostExerciseName ? (
        <p className="mt-2 text-[11px] text-white/40">
          Ghost był na: {delta.ghostExerciseName}
        </p>
      ) : null}
    </div>
  );
}
