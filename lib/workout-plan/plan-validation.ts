import { z } from "zod";

/** Limity BR-4 / BR-5 — jedno źródło prawdy dla UI i serwera. */
export const PLAN_NAME_MAX = 80;
export const EXERCISE_NAME_MIN = 2;
export const EXERCISE_NAME_MAX = 80;
export const NOTE_MAX = 200;
export const TEMPO_MAX = 8;
export const MAX_EXERCISES_PER_PLAN = 30;
export const MAX_PLANS_PER_USER = 50;
export const SETS_MIN = 1;
export const SETS_MAX = 20;
export const REPS_MIN = 1;
export const REPS_MAX = 999;
export const RIR_MIN = 0;
export const RIR_MAX = 5;

export const workoutPlanExerciseSchema = z.object({
  id: z.string().min(1).max(80),
  name: z.string().trim().min(EXERCISE_NAME_MIN).max(EXERCISE_NAME_MAX),
  categoryId: z.string().min(1).max(40),
  sets: z.number().int().min(SETS_MIN).max(SETS_MAX),
  reps: z.number().int().min(REPS_MIN).max(REPS_MAX),
  rir: z.number().int().min(RIR_MIN).max(RIR_MAX).nullable().optional(),
  tempo: z.string().trim().max(TEMPO_MAX).nullable().optional(),
  note: z.string().trim().max(NOTE_MAX).nullable().optional(),
  techniqueYoutubeUrl: z.string().trim().max(500).nullable().optional(),
  supersetGroupId: z.string().trim().max(80).nullable().optional(),
});

export const workoutPlanPayloadSchema = z.object({
  version: z.literal(2),
  path: z.literal("custom"),
  planName: z.string().trim().min(1).max(PLAN_NAME_MAX),
  exercises: z.array(workoutPlanExerciseSchema).max(MAX_EXERCISES_PER_PLAN),
  userCustomExerciseNames: z.array(z.string().trim().min(1).max(EXERCISE_NAME_MAX)).max(200),
});

export type ValidatedWorkoutPlanPayload = z.infer<typeof workoutPlanPayloadSchema>;

export function validateWorkoutPlanPayload(input: unknown):
  | { ok: true; plan: ValidatedWorkoutPlanPayload }
  | { ok: false; error: string } {
  const parsed = workoutPlanPayloadSchema.safeParse(input);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    if (first?.path.join(".") === "planName") {
      return { ok: false, error: "Podaj nazwę planu (1–80 znaków)." };
    }
    if (first?.path.includes("exercises")) {
      return {
        ok: false,
        error: "Sprawdź ćwiczenia: serie 1–20, powtórzenia 1–999, RIR 0–5.",
      };
    }
    return { ok: false, error: "Nieprawidłowy format planu." };
  }
  return { ok: true, plan: parsed.data };
}
