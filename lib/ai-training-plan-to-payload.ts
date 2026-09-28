import type { WorkoutPlanExercise, WorkoutPlanPayload } from "@/lib/workout-plan-types";
import { findBestCatalogMatch } from "@/lib/workout-exercise-catalog";

/** Minimalny kształt dnia z generateTrainingPlan (bez importu server-only). */
export type AiTrainingPlanLike = {
  days: Array<{
    day: number;
    title: string;
    type: "strength" | "cardio" | "hybrid" | "rest";
    session: {
      main: Array<{
        name: string;
        sets: number;
        reps: string;
        restSec: number;
        notes: string;
      }>;
    };
  }>;
};

function parseReps(reps: string): number {
  const m = reps.match(/(\d+)/);
  if (!m) return 10;
  const n = Number.parseInt(m[1]!, 10);
  return Number.isFinite(n) && n > 0 ? Math.min(99, n) : 10;
}

function parseSets(sets: number): number {
  if (!Number.isFinite(sets) || sets < 1) return 3;
  return Math.min(20, Math.round(sets));
}

/** Mapuje dni strength/hybrid z AI na osobne plany GymBrat. */
export function trainingPlanToWorkoutPayloads(
  plan: AiTrainingPlanLike,
): WorkoutPlanPayload[] {
  const out: WorkoutPlanPayload[] = [];
  for (const day of plan.days) {
    if (day.type !== "strength" && day.type !== "hybrid") continue;
    const main = day.session.main ?? [];
    if (main.length === 0) continue;
    const exercises: WorkoutPlanExercise[] = main.map((ex) => {
      const hit = findBestCatalogMatch(ex.name);
      return {
        id: crypto.randomUUID(),
        name: hit?.name ?? ex.name,
        categoryId: hit?.categoryId ?? "chest",
        sets: parseSets(ex.sets),
        reps: parseReps(ex.reps),
        rir: 1,
        tempo: null,
        note: ex.notes?.trim() || null,
        supersetGroupId: null,
      };
    });
    out.push({
      version: 2,
      path: "custom",
      planName: day.title.trim() || `Dzień ${day.day}`,
      exercises,
      userCustomExerciseNames: [],
    });
  }
  return out;
}
