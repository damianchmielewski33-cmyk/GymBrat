"use server";

import { aiGeneratePlan } from "@/actions/backend";
import { saveWorkoutPlan } from "@/actions/workout-plan";
import { trainingPlanToWorkoutPayloads } from "@/lib/ai-training-plan-to-payload";
import { UserMessages } from "@/lib/user-facing-errors";

/** Generuje plan AI i zapisuje dni strength/hybrid jako osobne plany użytkownika. */
export async function generateAndSaveAiWorkoutPlans(overrides?: {
  daysPerWeek?: number;
  experienceLevel?: "beginner" | "intermediate" | "advanced";
  goals?: string[];
  equipment?: string[];
}) {
  const generated = await aiGeneratePlan(overrides ?? {});
  if (!generated.ok) {
    return { ok: false as const, error: generated.error };
  }

  const payloads = trainingPlanToWorkoutPayloads(generated.plan);
  if (payloads.length === 0) {
    return {
      ok: false as const,
      error:
        "Model nie zwrócił dni siłowych. Spróbuj ponownie albo ustaw więcej dni w tygodniu.",
    };
  }

  const ids: string[] = [];
  for (const plan of payloads) {
    const res = await saveWorkoutPlan(plan);
    if (!res.ok) {
      return {
        ok: false as const,
        error: res.error || UserMessages.networkOrServer,
      };
    }
    ids.push(res.id);
  }

  return { ok: true as const, ids, count: ids.length };
}
