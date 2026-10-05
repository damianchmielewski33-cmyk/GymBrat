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
    const targetRir =
      typeof ex.rir === "number" && Number.isFinite(ex.rir) ? ex.rir : 1;
    return {
      id: ex.id,
      name: ex.name,
      targetSets: setCount,
      targetReps: reps ?? undefined,
      targetRir,
      tempo: ex.tempo ?? null,
      note: ex.note?.trim() || undefined,
      techniqueYoutubeUrl: ex.techniqueYoutubeUrl?.trim() || null,
      supersetGroupId: ex.supersetGroupId ?? null,
      sets: Array.from({ length: setCount }, () => ({
        reps,
        weight: 0,
        done: false,
        rpe: null,
        rir: targetRir,
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
  setHideGlobalBarForRoute: (hide: boolean) => void;
};

/** Reset + załaduj plan i oznacz sesję jako świeży start (bez promptu wznowienia). */

export function beginWorkoutFromPlanRow(
  store: ActiveWorkoutStartApi,
  row: WorkoutPlanWithLastWorkoutDTO,
): boolean {
  if (row.plan.exercises.length === 0) return false;
  store.setHideGlobalBarForRoute(true);
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

/** Etykieta celu jak w planie trenera: `2s 8-10 · RIR 1`. */
export function formatExerciseTargetLine(ex: WorkoutExerciseState): string {
  const sets = ex.targetSets ?? ex.sets.length;
  const reps = ex.targetReps;
  const parts: string[] = [];
  if (reps != null && reps > 0) {
    const max = Math.round(reps);
    const min = max >= 5 ? Math.max(1, max - 2) : max;
    parts.push(
      min === max ? `${sets}s ${max}p` : `${sets}s ${min}-${max}`,
    );
  } else {
    parts.push(`${sets}s`);
  }
  if (ex.targetRir != null) parts.push(`RIR ${ex.targetRir}`);
  if (ex.tempo) parts.push(`tempo ${ex.tempo}`);
  if (ex.supersetGroupId) parts.push("superseria");
  return parts.join(" · ");
}

/** Etykiety A1, A2, B1… dla grup superserii w kolejności planu. */
export function buildSupersetLabels(
  exercises: Array<{ id: string; supersetGroupId?: string | null }>,
): Record<string, string> {
  const labels: Record<string, string> = {};
  const groupLetter = new Map<string, string>();
  const groupIndex = new Map<string, number>();
  let nextLetter = 0;
  for (const ex of exercises) {
    const g = ex.supersetGroupId?.trim();
    if (!g) continue;
    if (!groupLetter.has(g)) {
      groupLetter.set(g, String.fromCharCode(65 + (nextLetter % 26)));
      nextLetter += 1;
      groupIndex.set(g, 0);
    }
    const idx = (groupIndex.get(g) ?? 0) + 1;
    groupIndex.set(g, idx);
    labels[ex.id] = `${groupLetter.get(g)}${idx}`;
  }
  return labels;
}
