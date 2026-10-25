import type { GhostCheckpoint, GhostTimeline, GhostSourceKind } from "@/lib/ghost-training/types";
import { isCompletedWorkoutSet } from "@/lib/workout-skipped-sets";

type RawSet = {
  reps?: number | null;
  weight?: number;
  done?: boolean;
  skipped?: boolean;
  restSeconds?: number | null;
  elapsedSecondsAtCompletion?: number | null;
};

type RawExercise = {
  id?: string;
  name?: string;
  sets?: RawSet[];
};

const DEFAULT_SET_SECONDS = 45;

function parseExercises(json: string): RawExercise[] {
  try {
    const parsed = JSON.parse(json) as unknown;
    if (Array.isArray(parsed)) return parsed as RawExercise[];
    if (parsed && typeof parsed === "object") {
      const o = parsed as { exercises?: unknown };
      if (Array.isArray(o.exercises)) return o.exercises as RawExercise[];
    }
  } catch {
    /* */
  }
  return [];
}

export function buildGhostTimeline(input: {
  sourceKind: GhostSourceKind;
  sourceUserId: string;
  sourceLabel: string;
  workoutId: string;
  planId: string | null;
  title: string;
  exercisesJson: string;
  sessionDurationSeconds?: number | null;
}): GhostTimeline {
  const exercises = parseExercises(input.exercisesJson);
  const checkpoints: GhostCheckpoint[] = [];
  let cumulativeSets = 0;
  let cumulativeVolume = 0;
  let syntheticElapsed = 0;
  let hasRealTimestamps = false;

  for (const ex of exercises) {
    const sets = ex.sets ?? [];
    for (let i = 0; i < sets.length; i++) {
      const s = sets[i]!;
      const reps = Number(s.reps) || 0;
      const weight = Number(s.weight) || 0;
      // LR-3 / V-2: tylko faktycznie zaliczone serie (done===true, niepominięte,
      // z realnym ciężarem i powtórzeniami) wchodzą do osi czasu Ghost Training —
      // widoczną dla rywala. Prefill/draft zapisany przez flushDraft (np. przy
      // nawigacji) bez kliknięcia „Zapisz serię” nie ma done===true i jest tu
      // wykluczony, tak jak w `lib/last-workout-hints.ts`.
      if (
        !isCompletedWorkoutSet({
          done: Boolean(s.done),
          skipped: s.skipped,
          reps: s.reps ?? null,
          weight,
        })
      ) {
        continue;
      }

      cumulativeSets += 1;
      cumulativeVolume += weight * reps;

      let elapsed: number;
      if (
        s.elapsedSecondsAtCompletion != null &&
        Number.isFinite(s.elapsedSecondsAtCompletion)
      ) {
        elapsed = Math.max(0, Math.floor(s.elapsedSecondsAtCompletion));
        hasRealTimestamps = true;
      } else {
        syntheticElapsed += DEFAULT_SET_SECONDS + (Number(s.restSeconds) || 90);
        elapsed = syntheticElapsed;
      }

      checkpoints.push({
        elapsedSeconds: elapsed,
        exerciseId: ex.id ?? `ex-${checkpoints.length}`,
        exerciseName: ex.name ?? "Ćwiczenie",
        setIndex: i,
        cumulativeSets,
        cumulativeVolumeKg: cumulativeVolume,
        weight,
        reps,
      });
    }
  }

  checkpoints.sort((a, b) => a.elapsedSeconds - b.elapsedSeconds);

  const totalDurationSeconds =
    input.sessionDurationSeconds && input.sessionDurationSeconds > 0
      ? input.sessionDurationSeconds
      : checkpoints.length > 0
        ? checkpoints[checkpoints.length - 1]!.elapsedSeconds
        : 0;

  return {
    sourceKind: input.sourceKind,
    sourceUserId: input.sourceUserId,
    sourceLabel: input.sourceLabel,
    workoutId: input.workoutId,
    planId: input.planId,
    title: input.title,
    synthetic: !hasRealTimestamps && checkpoints.length > 0,
    checkpoints,
    totalDurationSeconds,
    totalSets: cumulativeSets,
    totalVolumeKg: cumulativeVolume,
  };
}
