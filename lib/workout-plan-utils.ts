import { randomUUID } from "node:crypto";
import type { WorkoutPlanExercise, WorkoutPlanPayload } from "@/lib/workout-plan-types";

type LegacyWeekDay = {
  dayKey: string;
  title: string;
  exercises: Array<{ id: string; name: string }>;
};

type LegacyWorkoutPlanV1 = {
  version: 1;
  week: LegacyWeekDay[];
};

function migrateV1ToV2(legacy: LegacyWorkoutPlanV1): WorkoutPlanPayload {
  const firstTitle = legacy.week.find((d) => d.title.trim())?.title?.trim();
  const planName = firstTitle ?? "Mój plan treningowy";
  const exercises: WorkoutPlanExercise[] = [];
  for (const day of legacy.week) {
    for (const ex of day.exercises) {
      exercises.push({
        id: ex.id,
        name: ex.name,
        categoryId: "shoulders",
        reps: 10,
      });
    }
  }
  return {
    version: 2,
    path: "custom",
    planName,
    exercises,
    userCustomExerciseNames: [],
  };
}

export function normalizeWorkoutPlan(raw: unknown): WorkoutPlanPayload | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (o.version === 2 && o.path === "custom") {
    const planName = typeof o.planName === "string" ? o.planName : "";
    const exercises = Array.isArray(o.exercises) ? o.exercises : [];
    const userCustomExerciseNames = Array.isArray(o.userCustomExerciseNames)
      ? (o.userCustomExerciseNames as string[]).filter(
          (x) => typeof x === "string" && x.trim().length > 0,
        )
      : [];
    const safeExercises: WorkoutPlanExercise[] = exercises
      .filter((e): e is Record<string, unknown> => e !== null && typeof e === "object")
      .map((e) => ({
        id: typeof e.id === "string" ? e.id : randomUUID(),
        name: typeof e.name === "string" ? e.name : "Ćwiczenie",
        categoryId:
          typeof e.categoryId === "string" && e.categoryId ? e.categoryId : "chest",
        reps:
          typeof e.reps === "number" && Number.isFinite(e.reps) && e.reps > 0
            ? Math.round(e.reps)
            : 10,
      }));
    return {
      version: 2,
      path: "custom",
      planName,
      exercises: safeExercises,
      userCustomExerciseNames,
    };
  }
  if (o.version === 1 && Array.isArray(o.week)) {
    return migrateV1ToV2(o as LegacyWorkoutPlanV1);
  }
  return null;
}
