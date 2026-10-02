import {
  compareWorkoutExercises,
  type WorkoutHistoryExerciseCompare,
} from "@/lib/workout-history-overview";
import {
  computeWorkoutDetails,
  deltaPercent,
  type CompletedWorkoutDetails,
} from "@/lib/workout-history";
import { calendarDateKey } from "@/lib/local-date";

export type WorkoutPlanCompareExerciseRow = {
  name: string;
  currentVolumeKg: number;
  previousVolumeKg: number | null;
  deltaPercent: number | null;
  status: "up" | "down" | "flat" | "new" | "skipped";
};

export type WorkoutPlanComparePayload = {
  volumeDeltaPercent: number | null;
  currentVolumeKg: number;
  previousVolumeKg: number | null;
  previousDate: string | null;
  planLabel: string | null;
  compare: WorkoutHistoryExerciseCompare | null;
  exercises: WorkoutPlanCompareExerciseRow[];
};

function normalizeName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

function exerciseStatus(
  curVol: number,
  prevVol: number | null,
  done: boolean,
): WorkoutPlanCompareExerciseRow["status"] {
  if (!done) return "skipped";
  if (prevVol == null) return "new";
  if (curVol > prevVol + 0.5) return "up";
  if (curVol < prevVol - 0.5) return "down";
  return "flat";
}

export function buildExerciseVolumeRows(
  current: CompletedWorkoutDetails,
  previous: CompletedWorkoutDetails | null,
): WorkoutPlanCompareExerciseRow[] {
  const prevByName = new Map<string, CompletedWorkoutDetails["exercises"][number]>();
  if (previous) {
    for (const ex of previous.exercises) {
      prevByName.set(normalizeName(ex.name), ex);
    }
  }

  const rows: WorkoutPlanCompareExerciseRow[] = [];
  const seen = new Set<string>();

  for (const ex of current.exercises) {
    const key = normalizeName(ex.name);
    seen.add(key);
    const done = ex.sets.some((s) => s.done);
    const prev = prevByName.get(key) ?? null;
    const prevVol = prev && prev.sets.some((s) => s.done) ? prev.volumeKg : null;
    rows.push({
      name: ex.name,
      currentVolumeKg: ex.volumeKg,
      previousVolumeKg: prevVol,
      deltaPercent: prevVol != null ? deltaPercent(ex.volumeKg, prevVol) : null,
      status: exerciseStatus(ex.volumeKg, prevVol, done),
    });
  }

  if (previous) {
    for (const prev of previous.exercises) {
      const key = normalizeName(prev.name);
      if (seen.has(key)) continue;
      if (!prev.sets.some((s) => s.done)) continue;
      rows.push({
        name: prev.name,
        currentVolumeKg: 0,
        previousVolumeKg: prev.volumeKg,
        deltaPercent: null,
        status: "skipped",
      });
    }
  }

  return rows;
}

export function buildWorkoutPlanCompare(input: {
  currentExercisesJson: string;
  previousExercisesJson: string | null;
  currentDate: string;
  previousDate: string | null;
  workoutPlanId: string | null;
  planLabel: string | null;
}): WorkoutPlanComparePayload {
  const current = computeWorkoutDetails({
    id: "current",
    date: input.currentDate,
    rawJson: input.currentExercisesJson,
    workoutPlanId: input.workoutPlanId,
    planName: input.planLabel,
  });

  const previous =
    input.previousExercisesJson != null
      ? computeWorkoutDetails({
          id: "previous",
          date: input.previousDate ?? input.currentDate,
          rawJson: input.previousExercisesJson,
          workoutPlanId: input.workoutPlanId,
          planName: input.planLabel,
        })
      : null;

  if (!current) {
    return {
      volumeDeltaPercent: null,
      currentVolumeKg: 0,
      previousVolumeKg: null,
      previousDate: null,
      planLabel: input.planLabel,
      compare: null,
      exercises: [],
    };
  }

  const compare = compareWorkoutExercises(current, previous);
  const previousVolumeKg = previous?.volumeKg ?? null;

  return {
    volumeDeltaPercent:
      previousVolumeKg != null ? deltaPercent(current.volumeKg, previousVolumeKg) : null,
    currentVolumeKg: current.volumeKg,
    previousVolumeKg,
    previousDate: previous ? input.previousDate : null,
    planLabel: input.planLabel,
    compare,
    exercises: buildExerciseVolumeRows(current, previous),
  };
}

/** Buduje raw JSON completed_session z payloadu zapisu. */
export function completedSessionJsonForCompare(input: {
  title: string;
  startedAtMs: number;
  endedAtMs: number;
  workoutPlanId: string | null;
  exercises: unknown;
  cardioMinutes?: number;
}): string {
  const cardioMinutes = Math.max(0, Math.round(Number(input.cardioMinutes ?? 0)));
  return JSON.stringify({
    kind: "completed_session",
    title: input.title,
    startedAt: input.startedAtMs,
    endedAt: input.endedAtMs,
    workoutPlanId: input.workoutPlanId,
    exercises: input.exercises ?? null,
    ...(cardioMinutes > 0 ? { cardioMinutes } : {}),
  });
}

export function todayKeyFromMs(ms: number): string {
  return calendarDateKey(new Date(ms));
}
