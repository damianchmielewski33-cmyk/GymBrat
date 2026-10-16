/**
 * Fatigue score 0–100 — obniża confidence, nie wymusza deloadu.
 */

import { classifyEffort } from "@/lib/set-effort";
import { isCompletedWorkoutSet } from "@/lib/workout-skipped-sets";
import type { FatigueReport } from "@/lib/live-coach/types";
import type { WorkoutExerciseState, WorkoutSetState } from "@/components/workout/types";

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n)));
}

export function computeSessionFatigue(args: {
  exercises: WorkoutExerciseState[];
  /** Indeks bieżącego ćwiczenia (0-based). */
  exerciseIndex: number;
  /** Serie bieżącego ćwiczenia do exclusive setIndex. */
  upToSetIndex?: number;
  durationMinutes?: number | null;
}): FatigueReport {
  let volume = 0;
  let hardSets = 0;
  let warnSets = 0;
  let shortRests = 0;
  let completedSets = 0;

  const limitEx = Math.min(args.exercises.length, args.exerciseIndex + 1);
  for (let ei = 0; ei < limitEx; ei++) {
    const ex = args.exercises[ei]!;
    const setLimit =
      ei === args.exerciseIndex && args.upToSetIndex != null
        ? args.upToSetIndex
        : ex.sets.length;
    for (let si = 0; si < setLimit; si++) {
      const s = ex.sets[si]!;
      if (!isCompletedWorkoutSet(s)) continue;
      completedSets += 1;
      if (s.reps != null && s.reps > 0 && s.weight > 0) {
        volume += s.weight * s.reps;
      }
      const effort = classifyEffort(s);
      if (effort === "hard") hardSets += 1;
      if (effort === "warn" || effort === "hard") warnSets += 1;
      if (
        s.restSeconds != null &&
        Number.isFinite(s.restSeconds) &&
        s.restSeconds < 60
      ) {
        shortRests += 1;
      }
    }
  }

  const duration = args.durationMinutes ?? null;
  let score = 8;
  score += Math.min(28, volume / 800);
  score += hardSets * 10;
  score += Math.max(0, warnSets - hardSets) * 5;
  score += args.exerciseIndex * 4;
  score += shortRests * 4;
  if (duration != null && duration > 0) {
    score += Math.min(18, duration / 4);
  }
  score += Math.min(12, completedSets * 1.5);

  return {
    score: clamp01(score),
    factors: {
      sessionVolume: volume,
      hardSets,
      warnSets,
      exerciseIndex: args.exerciseIndex,
      shortRests,
      durationMinutes: duration,
    },
  };
}

/** Fatigue tylko z serii jednego ćwiczenia (gdy brak pełnej listy). */
export function computeExerciseLocalFatigue(
  sets: WorkoutSetState[],
  upToExclusive: number,
): FatigueReport {
  const fake: WorkoutExerciseState = {
    id: "_",
    name: "_",
    sets,
  };
  return computeSessionFatigue({
    exercises: [fake],
    exerciseIndex: 0,
    upToSetIndex: upToExclusive,
  });
}
