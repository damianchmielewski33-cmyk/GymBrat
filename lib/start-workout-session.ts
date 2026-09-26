import type { WorkoutPlanWithLastWorkoutDTO } from "@/actions/workout-plan";
import type { WorkoutExerciseState } from "@/components/workout/types";
import type { WorkoutPlanExercise, WorkoutPlanPayload } from "@/lib/workout-plan-types";

function clampInt(n: number, min: number, max: number) {
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, Math.round(n)));
}

/** Mapuje ćwiczenia z planu na stan sesji prowadzonej. */
export function planExercisesToSession(
  exercises: WorkoutPlanExercise[],
): WorkoutExerciseState[] {
  return exercises.map((ex) => {
    const setCount =
      typeof ex.sets === "number" && Number.isFinite(ex.sets) && ex.sets > 0
        ? clampInt(ex.sets, 1, 20)
        : 3;
    const reps =
      typeof ex.reps === "number" && Number.isFinite(ex.reps) && ex.reps > 0
        ? clampInt(ex.reps, 1, 99)
        : null;
    return {
      id: ex.id,
      name: ex.name,
      targetSets: setCount,
      targetReps: reps ?? undefined,
      targetRir: 1,
      tempo: null,
      sets: Array.from({ length: setCount }, () => ({
        reps,
        weight: 0,
        done: false,
        rpe: null,
        rir: 1,
      })),
    };
  });
}

export type ActiveWorkoutStartApi = {
  reset: () => void;
  applyPlan: (planId: string, plan: WorkoutPlanPayload) => void;
  setExercises: (exercises: WorkoutExerciseState[]) => void;
  setSelectedExerciseId: (id: string | null) => void;
  start: () => void;
};

/** Reset + załaduj plan i oznacz sesję jako świeży start (bez promptu wznowienia). */
export function beginWorkoutFromPlanRow(
  store: ActiveWorkoutStartApi,
  row: WorkoutPlanWithLastWorkoutDTO,
): boolean {
  if (row.plan.exercises.length === 0) return false;
  store.reset();
  store.applyPlan(row.id, row.plan);
  const next = planExercisesToSession(row.plan.exercises);
  store.setExercises(next);
  store.setSelectedExerciseId(next[0]?.id ?? null);
  store.start();
  if (typeof sessionStorage !== "undefined") {
    sessionStorage.setItem("active-workout:skipResumeOnce", "1");
  }
  return true;
}

/** Etykieta celu jak w planie trenera: `2s 8p · RIR 1`. */
export function formatExerciseTargetLine(ex: WorkoutExerciseState): string {
  const sets = ex.targetSets ?? ex.sets.length;
  const reps = ex.targetReps;
  const parts: string[] = [];
  if (reps != null && reps > 0) parts.push(`${sets}s ${reps}p`);
  else parts.push(`${sets}s`);
  if (ex.targetRir != null) parts.push(`RIR ${ex.targetRir}`);
  if (ex.tempo) parts.push(`tempo ${ex.tempo}`);
  return parts.join(" · ");
}
