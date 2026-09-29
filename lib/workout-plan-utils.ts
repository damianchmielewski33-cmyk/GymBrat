import { randomUUID } from "node:crypto";
import type { WorkoutPlanExercise, WorkoutPlanPayload } from "@/lib/workout-plan-types";
import { normalizeYoutubeUrl } from "@/lib/youtube-url";

type LegacyWeekDay = {
  dayKey: string;
  title: string;
  exercises: Array<{ id: string; name: string }>;
};

type LegacyWorkoutPlanV1 = {
  version: 1;
  week: LegacyWeekDay[];
};

function optionalRir(raw: unknown): number | null {
  if (raw == null || raw === "") return null;
  const n = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(n)) return null;
  return Math.max(0, Math.min(5, Math.round(n)));
}

function optionalTempo(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const t = raw.trim().slice(0, 16);
  return t.length > 0 ? t : null;
}

function optionalNote(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const t = raw.trim().slice(0, 500);
  return t.length > 0 ? t : null;
}

function optionalTechniqueYoutubeUrl(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  return normalizeYoutubeUrl(raw);
}

function optionalSuperset(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const t = raw.trim().slice(0, 64);
  return t.length > 0 ? t : null;
}

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
        sets: 3,
        rir: null,
        tempo: null,
        note: null,
        techniqueYoutubeUrl: null,
        supersetGroupId: null,
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
        sets:
          typeof e.sets === "number" && Number.isFinite(e.sets) && e.sets > 0
            ? Math.min(20, Math.round(e.sets))
            : 3,
        rir: optionalRir(e.rir),
        tempo: optionalTempo(e.tempo),
        note: optionalNote(e.note),
        techniqueYoutubeUrl: optionalTechniqueYoutubeUrl(e.techniqueYoutubeUrl),
        supersetGroupId: optionalSuperset(e.supersetGroupId),
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
